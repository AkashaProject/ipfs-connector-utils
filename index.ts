/// <reference path="typings/main.d.ts"/>
import * as isIpfs from 'is-ipfs';
import * as CID from 'cids';
import { Buffer } from 'safe-buffer';

export default class IpfsApiHelper {
  public ipfsApi: any;

  // default options for storing DAG nodes
  public _dagOptions = {};

  /**
   * Requires an instance of ipfs-http-client or js-ipfs
   * @param provider
   */
  constructor (provider: any) {
    this.ipfsApi = provider;
  }

  /**
   * Transform js object to Buffer instance
   * @param data
   * @returns {Buffer}
   */
  public static toDataBuffer (data: object) {
    if (IpfsApiHelper.Buffer.isBuffer(data)) {
      return data;
    }
    return IpfsApiHelper.Buffer.from(JSON.stringify(data));
  }

  public static get isIpfs () {
    return isIpfs;
  }

  public static get Buffer () {
    return Buffer;
  }

  /**
   * Create a node for the `data`
   * @param data
   */
  public async add (data: object) {
    return await this.ipfsApi.dag.put(data, this._dagOptions);
  }

  /**
   * Read data from IPFS path
   * @param cid
   * @param path
   */
  public async get (cid: string | object, path: string) {
    return await this.ipfsApi.dag.get(cid, path);
  }

  /**
   * Creates a node from `data` and references it in a link
   * @param data
   * @param name
   */
  public async addLinkFrom (data: object, name: string) {
    const cid = await this.add(data);
    return await this.addLink(cid, name);
  }

  /**
   * Creates a node with a property linked to a CID
   * @param cid
   * @param name
   */
  public async addLink (cid: string | object, name: string) {
    const linkedCid = (typeof cid === 'string' || cid instanceof String) ? new CID(cid) : cid;

    if (!CID.isCID(linkedCid)) {
      throw new Error('Supplied CID is not valid');
    }
    return await this.add({ [name]: linkedCid });
  }
}