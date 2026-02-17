import { openDB, type DBSchema } from 'idb';

interface PlaceEraDB extends DBSchema {
    lessons: {
        key: string; // date string YYYY-MM-DD
        value: any; // The lesson object
    };
    syncQueue: {
        key: number; // auto-increment
        value: {
            url: string;
            method: 'POST' | 'PUT';
            body: any;
            createdAt: number;
        };
    };
    userProgress: {
        key: string;
        value: any;
    };
}

const DB_NAME = 'placeera-db';
const DB_VERSION = 1;

export const initDB = async () => {
    return openDB<PlaceEraDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('lessons')) {
                db.createObjectStore('lessons');
            }
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('userProgress')) {
                db.createObjectStore('userProgress');
            }
        },
    });
};

export const saveLesson = async (lesson: any) => {
    const db = await initDB();
    const dateKey = new Date(lesson.date).toISOString().split('T')[0];
    await db.put('lessons', lesson, dateKey); // Use normalized date keys
    // Also save as 'latest' for quick access?
    await db.put('lessons', lesson, 'latest');
};

export const getLesson = async (date?: string) => {
    const db = await initDB();
    if (!date) return db.get('lessons', 'latest');
    return db.get('lessons', date);
};

export const addToSyncQueue = async (url: string, method: 'POST' | 'PUT', body: any) => {
    const db = await initDB();
    await db.add('syncQueue', {
        url,
        method,
        body,
        createdAt: Date.now(),
    });
};

export const getSyncQueue = async () => {
    const db = await initDB();
    return db.getAll('syncQueue');
};

export const clearSyncQueueItem = async (key: number) => {
    const db = await initDB();
    await db.delete('syncQueue', key);
};
