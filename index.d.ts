/// <reference path="typings/main.d.ts" />
/// <reference types="node" />
/// <reference types="bluebird" />
import * as Promise from 'bluebird';
export default class IpfsApiHelper {
    apiClient: any;
    private _objectMaxSize;
    private _requestTimeout;
    private _encoding;
    constructor(provider: any);
    readonly ENCODING: string;
    readonly OBJECT_MAX_SIZE: number;
    readonly REQUEST_TIMEOUT: number;
    setObjectMaxSize(size: number): void;
    setRequestTimeout(time: number): void;
    setEncoding(encode: string): void;
    static toDataBuffer(data: Object): Buffer;
    static fromRawData(rawData: any): any;
    static fromRawObject(rawObject: any): any;
    add(data: any, isFile?: boolean): Promise<{
        hash: string;
        size: number;
    }>;
    addObject(data: Buffer): any;
    addFile(dataBuffer: Buffer): any;
    get(objectHash: string, isFile?: boolean): any;
    getObject(objectHash: string, raw?: boolean): any;
    getFile(hash: string): Promise<{}>;
    getStats(objectHash: string): any;
    getLinks(hash: string, enc?: string): any;
    updateObject(hash: string, newData: Object): any;
    createNode(data: any, links: any[]): any;
    findLinks(hash: string, names: string[]): any;
    findLinkPath(start: string, path: string[]): any;
    addLinkFrom(data: any, name: string, root: string, enc?: string): Promise<any>;
    addLink(link: {
        name: string;
        size: number;
        hash: string;
    }, root: string, enc?: string): any;
}
