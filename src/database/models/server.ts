import { model, Document, Schema } from 'mongoose';
import { History } from './tag';
import { User } from './user';

export interface ServerSettings {
    danger: boolean;
    url: boolean;
    private: boolean;
}

interface User {
    points?: number;
    level?: number;
}

export interface IServer extends Document {
    serverID: string;
    recent: History[];
    settings: ServerSettings;
    users: Map<string, User>;
}

const serverSchema = new Schema(
    {
        serverID: String,
        users: {
            $type: Map,
            default: new Map<
                String,
                {
                    points: Number;
                    level: Number;
                }
            >(),
        },
        recent: [
            {
                id: String,
                type: String,
                name: String,
                author: String,
                guild: String,
                date: Number,
            },
        ],
        settings: {
            danger: {
                $type: Boolean,
                default: false,
            },
            url: {
                $type: Boolean,
                default: false,
            },
            private: {
                $type: Boolean,
                default: false,
            },
        },
    },
    { typeKey: '$type', strict: false }
);

export const Server = model<IServer>('Server', serverSchema);
