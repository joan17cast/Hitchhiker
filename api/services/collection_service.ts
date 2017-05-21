import { ResObject } from '../common/res_object';
import { Collection } from '../models/collection';
import { ConnectionManager } from "./connection_manager";
import { ObjectLiteral } from "typeorm/common/ObjectLiteral";
import { User } from "../models/user";
import { Message } from "../common/message";
import { StringUtil } from "../utils/string_util";
import { DtoCollection } from "../interfaces/dto_collection";
import { RecordService } from "./record_service";
import { TeamService } from "./team_service";
import { Team } from "../models/team";

export class CollectionService {

    static async save(collection: Collection) {
        const connection = await ConnectionManager.getInstance();
        await connection.getRepository(Collection).persist(collection);
    }

    static clone(collection: Collection): Collection {
        const target = <Collection>Object.create(collection);
        target.id = StringUtil.generateUID();
        target.records = target.records.map(r => RecordService.clone(r));
        target.createDate = new Date();
        return target;
    }

    static fromDto(dtoCollection: DtoCollection): Collection {
        const collection = new Collection();
        collection.id = dtoCollection.id || StringUtil.generateUID();
        collection.name = dtoCollection.name;
        collection.description = dtoCollection.description;
        collection.team = new Team();
        collection.team.id = dtoCollection.teamId;
        collection.records = [];
        return collection;
    }

    static toDto(collection: Collection): DtoCollection {
        return { ...collection, teamId: collection.team.id };
    }

    static async create(dtoCollection: DtoCollection, userId: string): Promise<ResObject> {
        const owner = new User();
        owner.id = userId;

        const collection = CollectionService.fromDto(dtoCollection);
        collection.owner = owner;

        await CollectionService.save(collection);
        return { success: true, message: Message.collectionCreateSuccess };
    }

    static async update(dtoCollection: DtoCollection, userId: string): Promise<ResObject> {
        const connection = await ConnectionManager.getInstance();

        await connection.getRepository(Collection)
            .createQueryBuilder('collection')
            .where('id=:id', { id: dtoCollection.id })
            .update({ name: dtoCollection.name, description: dtoCollection.description })
            .execute();
        return { success: true, message: Message.collectionUpdateSuccess };
    }

    static async delete(id: string): Promise<ResObject> {
        const connection = await ConnectionManager.getInstance();

        await connection.getRepository(Collection)
            .createQueryBuilder('collection')
            .where('id=:id', { id })
            .update({ recycle: true })
            .execute();
        return { success: true, message: Message.collectionDeleteSuccess };
    }

    static async getOwns(userId: string): Promise<Collection[]> {
        const connection = await ConnectionManager.getInstance();

        return await connection.getRepository(Collection)
            .createQueryBuilder("collection")
            .leftJoinAndSelect('collection.team', 'team')
            .leftJoinAndSelect('collection.owner', 'owner')
            .where('recycle = 0')
            .andWhere('owner.id = :userId')
            .orderBy('collection.name')
            .setParameter('userId', userId)
            .getMany();
    }

    static async getById(id: string, needRecords: boolean = false): Promise<Collection> {
        const connection = await ConnectionManager.getInstance();

        let rep = connection.getRepository(Collection)
            .createQueryBuilder("collection")
            .leftJoinAndSelect('collection.team', 'team')
            .leftJoinAndSelect('collection.owner', 'owner');

        if (needRecords) {
            rep = rep.leftJoinAndSelect('collection.records', 'records');
        }

        return await rep.where('recycle = 0')
            .andWhere('collection.id = :id')
            .setParameter('id', id)
            .getOne();
    }

    static async getByIds(ids: string[]): Promise<Collection[]> {
        const connection = await ConnectionManager.getInstance();

        return await connection.getRepository(Collection)
            .createQueryBuilder("collection")
            .leftJoinAndSelect('collection.team', 'team')
            .leftJoinAndSelect('collection.owner', 'owner')
            .where('recycle = 0')
            .andWhereInIds(ids)
            .getMany();
    }

    static async getByTeamId(teamid: string): Promise<Collection[]> {
        const connection = await ConnectionManager.getInstance();

        return await connection.getRepository(Collection)
            .createQueryBuilder("collection")
            .innerJoinAndSelect('collection.team', 'team', 'team.id=:id')
            .leftJoinAndSelect('collection.owner', 'owner')
            .where('recycle = 0')
            .setParameter('id', teamid)
            .getMany();
    }

    static async getByTeamIds(teamIds: string[]): Promise<Collection[]> {
        if (!teamIds) {
            return [];
        }

        const connection = await ConnectionManager.getInstance();
        const parameters: ObjectLiteral = {};
        const whereStrings = teamIds.map((id, index) => {
            parameters[`id_${index}`] = id;
            return `team.id=:id_${index}`;
        });
        const whereStr = whereStrings.length > 1 ? "(" + whereStrings.join(" OR ") + ")" : whereStrings[0];

        return await connection.getRepository(Collection)
            .createQueryBuilder("collection")
            .innerJoinAndSelect('collection.team', 'team')
            .leftJoinAndSelect('collection.owner', 'owner')
            .where('recycle = 0')
            .andWhere(whereStr, parameters)
            .orderBy('collection.name')
            .getMany();
    }

    static async shareCollection(collectionId: string, teamId: string): Promise<ResObject> {
        const origin = await CollectionService.getById(collectionId, true);
        if (!origin) {
            return { success: false, message: Message.collectionNotExist };
        }

        const target = CollectionService.clone(origin);
        target.team = TeamService.create(teamId);
        await CollectionService.save(origin);
    }
}