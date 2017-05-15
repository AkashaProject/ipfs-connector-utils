/// <reference path="typings/main.d.ts"/>
import * as Promise from 'bluebird';
import { multihash } from 'is-ipfs';
import { Readable } from 'stream';
import { DAGLink, DAGNode } from 'ipld-dag-pb';

export default class IpfsApiHelper {
    public apiClient: any;
    private _objectMaxSize = 256 * 1024;
    private _requestTimeout = 60 * 1000;
    private _encoding = 'base58';
    private _dagNode: any;
    private _dagLink: any;

    /**
     * Requires an instance of ipfs-api or ipfs
     * @param provider
     */
    constructor(provider: any) {
        this.apiClient = provider;
        this.apiClient.object = Promise.promisifyAll(this.apiClient.object);
        this.apiClient.object.patch = Promise.promisifyAll(this.apiClient.object.patch);
        this.apiClient.config = Promise.promisifyAll(this.apiClient.config);
        this.apiClient = Promise.promisifyAll(this.apiClient);
        this._dagNode = Promise.promisifyAll(DAGNode);
        this._dagLink = Promise.promisifyAll(DAGLink);

        if (!this.apiClient.hasOwnProperty('add') && this.apiClient.hasOwnProperty('files')) {
            Object.defineProperties(
                this.apiClient,
                {
                    addAsync: {
                        enumerable: true,
                        value: Promise.promisify(this.apiClient.files.add)
                    },
                    catAsync: {
                        enumerable: true,
                        value: Promise.promisify(this.apiClient.files.cat)
                    }
                }
            )
        }
    }

    /**
     *
     * @returns {string}
     */
    public get ENCODING() {
        return this._encoding;
    }

    /**
     *
     * @returns {number}
     */
    public get OBJECT_MAX_SIZE() {
        return this._objectMaxSize;
    }

    /**
     *
     * @returns {Object}
     * @constructor
     */
    public get DAGNode() {
        return this._dagNode;
    }

    /**
     *
     * @returns {Object}
     * @constructor
     */
    public get DAGLink() {
        return this._dagLink;
    }

    /**
     *
     * @returns {number}
     */
    public get REQUEST_TIMEOUT() {
        return this._requestTimeout;
    }

    /**
     * Set the maximum size for an ipfs object
     * Objects bigger than this value will be split
     * @param size
     */
    public setObjectMaxSize(size: number) {
        this._objectMaxSize = size;
    }

    /**
     * Set ipfs-api call timeout value
     * @param time
     */
    public setRequestTimeout(time: number) {
        this._requestTimeout = time;
    }

    /**
     * Set ipfs hash encoding
     * @param encode
     */
    public setEncoding(encode: string) {
        this._encoding = encode;
    }

    /**
     * Transform js object to Buffer instance
     * @param data
     * @returns {Buffer}
     */
    public static toDataBuffer(data: Object) {
        if (Buffer.isBuffer(data)) {
            return data;
        }
        return Buffer.from(JSON.stringify(data));
    }

    /**
     * Extract data from ipfs DAG instance
     * @param rawData
     * @returns {object}
     */
    public static fromRawData(rawData: any) {
        const jsonData = IpfsApiHelper.fromRawObject(rawData);
        let returned: any;
        try {
            returned = JSON.parse(jsonData.data);
        } catch (err) {
            returned = jsonData.data;
        }
        return returned;
    }

    /**
     *
     * @param rawObject
     * @returns {string|any|{type: "Buffer", data: any[]}|Object}
     */
    public static fromRawObject(rawObject: any) {
        return rawObject.toJSON();
    }

    /**
     * Add data to ipfs
     * @param data
     * @param isFile
     * @returns {Bluebird<{ hash: string, size: number }>}
     */
    public add(data: any, isFile = false): Promise<{ hash: string, size: number }> {
        let dataBuffer: Buffer;
        if (Buffer.isBuffer(data) || isFile) {
            dataBuffer = data;
        } else {
            dataBuffer = IpfsApiHelper.toDataBuffer(data);
        }
        // use file api for files and big js objects
        if (dataBuffer.length > this.OBJECT_MAX_SIZE || isFile) {
            return this.addFile(dataBuffer);
        }
        return this.addObject(dataBuffer);
    }

    /**
     * Save Buffer instance to an ipfs object
     * @param data
     * @returns {Bluebird}
     */
    public addObject(data: Buffer) {
        return this.apiClient
            .object
            .putAsync(data)
            .then((dagNode: any) => {
                const format = dagNode.toJSON();
                return { hash: format.multihash, size: format.size };
            });
    }

    /**
     * Save Buffer instance using ipfs file api
     * @param dataBuffer
     * @returns {Bluebird<{hash, size}>}
     */
    public addFile(dataBuffer: Buffer) {
        return this.apiClient
            .addAsync(dataBuffer)
            .then((file: any[]) => {
                return { hash: file[0].hash, size: file[0].size };
            });
    }

    /**
     *
     * @param objectHash
     * @param isFile
     * @returns {Promise<Buffer> | Promise<Object>}
     */
    public get(objectHash: string, isFile = false) {
        if (isFile) {
            return this.getFile(objectHash);
        }
        return this.getObject(objectHash);
    }

    /**
     * Get data from an ipfs hash
     * Returns a js or DAG object(raw)
     * @param objectHash
     * @param raw
     * @returns {Bluebird<U>}
     */
    public getObject(objectHash: string, raw?: boolean) {
        return this.apiClient
            .object
            .getAsync(objectHash, { enc: this._encoding })
            .timeout(this.REQUEST_TIMEOUT)
            .then((rawData: any) => {
                if (raw) {
                    return rawData;
                }
                return IpfsApiHelper.fromRawData(rawData);
            });
    }

    /**
     * Get contents of a file from ipfs
     * @param hash
     * @returns {Bluebird<Buffer>}
     */
    public getFile(hash: string) {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            let fileLength = 0;
            return this.apiClient
                .catAsync(hash)
                .timeout(this.REQUEST_TIMEOUT)
                .then((stream: Readable) => {
                    if (stream.readable) {
                        stream
                            .on('error', (err: Error) => {
                                return reject(err);
                            })
                            .on('data', (data: Buffer) => {
                                fileLength += data.length;
                                chunks.push(data);
                            })
                            .on('end', () => {
                                const file = Buffer.concat(chunks, fileLength);
                                resolve(file);
                            });
                        return;
                    }
                    return resolve(stream);
                });
        });
    }

    /**
     * Get statistics(size, links, etc) for an ipfs hash
     * @param objectHash
     * @returns {Bluebird<Object>}
     */
    public getStats(objectHash: string) {
        return this.apiClient
            .object
            .statAsync(objectHash, { enc: this._encoding })
            .timeout(this.REQUEST_TIMEOUT)
            .then((result: Object) => {
                return result;
            });
    }

    /**
     * Get ipfs hash DAGNode links
     * @param hash
     * @param enc
     * @returns {Bluebird}
     */
    public getLinks(hash: string, enc = this._encoding) {
        return this.apiClient.object.linksAsync(hash, { enc: enc });
    }

    /**
     * Patch an ipfs object
     * @param hash
     * @param newData
     * @param enc
     * @returns {PromiseLike<T>}
     */
    public updateObject(hash: string, newData: Object, enc = this._encoding) {
        return this.get(hash)
            .then((dataResponse: Object) => {
                const updatedObject = Object.assign({}, dataResponse, newData);
                const dataBuffer = IpfsApiHelper.toDataBuffer(updatedObject);
                // this returns a DAGNode
                return this.apiClient
                    .object
                    .patch
                    .setDataAsync(hash, dataBuffer, {enc: 'base58'});
            })
            .then((dagNode: any) => {
                return IpfsApiHelper.fromRawObject(dagNode);
            });
    }

    /**
     * Create an ipfs object containg data and links
     * @param data
     * @param links
     * @returns {Bluebird<U2|U1>|Thenable<U>|Bluebird<U>|Promise<TResult>|Bluebird<R>|Promise<T>|any}
     */
    public createNode(data: any, links: any[]) {
        return this._dagNode
            .createAsync(IpfsApiHelper.toDataBuffer(data), links)
            .then((dagNode: any) => {
                return this.addObject(dagNode);
            });
    }

    /**
     *
     * @param hash
     * @param names
     * @returns {Bluebird<undefined|T|number|any>}
     */
    public findLinks(hash: string, names: string []) {
        return this.getObject(hash, true)
            .then((dagNode: any) => {
                const format = dagNode.toJSON();
                return format.links.filter((link: any) => names.indexOf(link.name) !== -1);
            });
    }

    /**
     *
     * @param start
     * @param path
     * @returns {Function}
     */
    public findLinkPath(start: string, path: string []) {
        const _this = this;
        return Promise.coroutine(function*() {
            if (!multihash(start) || !path.length) {
                throw new Error('Invalid path');
            }
            let index = 0;
            let currentPath = yield _this.findLinks(start, path.slice(index, ++index));
            while (index < path.length && currentPath.length) {
                currentPath = yield _this.findLinks(currentPath[0].multihash, path.slice(index, ++index));
            }
            return currentPath;
        })();
    }


    /**
     * Creates an ipfs object containing a link
     * Handles ipfs hash for data
     * @param data
     * @param name
     * @param root
     * @param enc
     * @returns {PromiseLike<{size: number, hash: string}>|Promise<TResult|{size: number, hash: string}>|Bluebird<U>|PromiseLike<TResult|{size: number, hash: string}>|Thenable<U>|PromiseLike<TResult2|TResult1>|any}
     */
    public addLinkFrom(data: any, name: string, root: string, enc ?: string) {
        return this.add(data)
            .then((result: { size: number, hash: string }) => {
                return this.addLink({ name, size: result.size, hash: result.hash }, root, enc);
            });
    }

    /**
     * Patches an existing hash with a new link
     * @param link
     * @param root
     * @param enc
     * @returns {PromiseLike<T>|Promise<TResult|T>|Bluebird<U>|PromiseLike<TResult|T>|Thenable<U>|PromiseLike<TResult2|TResult1>|any}
     */
    public addLink(link: { name: string, size: number, hash: string }, root: string, enc = this._encoding) {
        const objLink = new DAGLink(link.name, link.size, link.hash);
        return this.apiClient.object.patch.addLinkAsync(root, objLink, { enc: enc })
            .then((dagNode: any) => {
                return IpfsApiHelper.fromRawObject(dagNode);
            });
    }
}