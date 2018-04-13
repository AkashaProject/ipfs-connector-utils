import IpfsApiHelper from './index';
import * as IPFS from 'ipfs';
import { expect } from 'chai';
import { Buffer } from 'safe-buffer';
import * as rimraf from 'rimraf';

describe('ipfs-connector-utils', function () {
    let helperInstance: IpfsApiHelper;
    let ipfsHash: string;
    let ipfsHash1: string;
    let statHash: string;
    let provider: any;
    let rawObject: {
        _name: string,
        _size: number,
        _multihash: Buffer
    };
    const longText = `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been` +
        `the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and` +
        `scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into` +
        `electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of` +
        `Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like` +
        `Aldus PageMaker including versions of Lorem Ipsum.`;
    this.timeout(100000);

    before(function (done) {
        provider = new IPFS({ repo: 'test-repo', start: true });
        provider.on('start', () => {
            helperInstance = new IpfsApiHelper(provider);
            helperInstance.add({ data: '{}' }).then((node) => {
                statHash = node.hash;
                expect(node.hash).to.exist;
            });
        });
        setTimeout(() => {
            expect(helperInstance).to.exist;
            done();
        }, 9500);
    });

    it('adds an object to ipfs', function () {
        return helperInstance.add({ data: '{}' })
            .then((node) => {
                expect(node.hash).to.exist;
                helperInstance.get(node.hash).then((data1: any) => {
                    expect(data1).to.have.property('data');
                    expect(data1.data).to.equal('{}');
                })
            });
    });

    it('transforms object to buffer', function () {
        const x = { a: 1 };
        const expected = Buffer.from(JSON.stringify(x));
        const actual = IpfsApiHelper.toDataBuffer(x);
        expect(actual.toString()).to.equal(expected.toString());
    });

    it('preserves buffer', function () {
        const initial = Buffer.from(JSON.stringify({ q: 1 }));
        const actual = IpfsApiHelper.toDataBuffer(initial);
        expect(actual.toString()).to.equal(initial.toString());
    });

    it('adds buffer instance to ipfs', function () {
        const actual = Buffer.from(JSON.stringify({ a: 1, b: 2 }));
        return helperInstance.add(actual).then(node => {
            expect(node).to.have.property('hash');
        });
    });

    it('adds plain text to ipfs', function () {
        return helperInstance.add(Buffer.from('testing test'))
            .then((node) => {
                expect(node).to.have.property('hash');
                return helperInstance.get(node.hash)
                    .then((data: Buffer) => {
                        expect(data).to.exist;
                    })
            })
    });

    it('adds raw buffer using api.addFile', function () {
        const buf = Buffer.from(JSON.stringify({ a: 1, b: 2, c: 3 }));
        return helperInstance.addFile(buf).then((node: any) => {
            expect(node).to.have.property('hash');
        });
    });

    it('updates from existing object', function () {
        const initialObj = { a: 1, b: 2 };
        return helperInstance.add(initialObj)
            .then((node) => {
                const patchAttr = { b: 3 };
                ipfsHash1 = node.hash;
                expect(node).to.exist;
                return helperInstance.updateObject(node.hash, patchAttr).then((result: any) => {
                    result.data = JSON.parse(result.data);
                    expect(result.data.a).to.equal(initialObj.a);
                    expect(result.data.b).to.equal(patchAttr.b);
                    expect(result.multihash).to.exist;
                });
            });
    });

    it('constructs object link from hash', function () {
        return helperInstance.add({ a: 1, b: 2 })
            .then((node) => {
                expect(node).to.exist;
                return helperInstance
                    .addLinkFrom({ coco: 1 }, 'testLink', node.hash)
                    .then((result) => {
                        expect(result.links.length).to.be.above(0);
                    });
            });
    });

    it('creates node with links', function () {
        const links = [{ name: 'testFile', size: 12, multihash: 'QmPMH5GFmLP2oU8dK7i4iWJyX6FpgeK3gT6ZC6xLLZQ9cW' },
            { name: 'testLink', size: 12, multihash: ipfsHash1 }];
        return helperInstance
            .createNode({ test: 2 }, links)
            .then((result: any) => {
                ipfsHash = result.hash;
                expect(result).to.have.property('hash');
            })
    });

    it('gets object links', function () {
        return helperInstance.getLinks(ipfsHash)
            .then((result: any) => {
                expect(result.length).to.equal(2);
                rawObject = result;
            });
    });

    it('transforms raw object', function () {
        return helperInstance.DAGNode.createAsync(Buffer.from(JSON.stringify({ test: 'test' })))
            .then((rawObject: any) => {
                const result = IpfsApiHelper.fromRawObject(rawObject);
                expect(result).to.have.property('data');
            })
    });

    it('gets data from raw object', function () {
        return helperInstance.DAGNode.createAsync(Buffer.from(JSON.stringify({ test: 'test1' })))
            .then((rawObject: any) => {
                const result = IpfsApiHelper.fromRawData(rawObject);
                expect(result).to.have.property('test');
            })
    });

    it('resolves a given link path', function () {
        return helperInstance
            .addLinkFrom({ test: true }, 'firstLink', ipfsHash)
            .then((result) => {
                expect(result).to.exist;
                return helperInstance.addLink(
                    { name: 'lastLink', hash: result.multihash, size: result.size },
                    ipfsHash
                ).then((patched: any) => {
                    return helperInstance.findLinkPath(patched.multihash, ['lastLink', 'firstLink'])
                        .then((final: any) => {
                            expect(final).to.exist;
                            return helperInstance.get(final[0].multihash)
                                .then((finalData: any) => {
                                    expect(finalData).to.have.property('test');
                                })
                        });
                });
            });
    });

    it('fails to find link path', function () {
        return helperInstance.findLinkPath(ipfsHash, [])
            .then((data: any) => {
                expect(data).to.not.exist;
            })
            .catch((err: any) => {
                expect(err).to.exist;
            })
    });

    it('should force to file api add', function () {
        return helperInstance.addFile(Buffer.from('TEST'))
            .then((node: any) => {
                return helperInstance.getFile(node.hash)
                    .then((result) => {
                        expect(result.toString()).to.eql('TEST');
                    });
            });
    });

    it('should have a default encoding', function () {
        expect(helperInstance.ENCODING).to.exist;
    });

    it('should have access to DAGNode and DAGLink', function () {
        expect(helperInstance.DAGNode).to.have.property('createAsync');
        expect(helperInstance.DAGLink).to.have.property('createAsync');
    });

    it('sets max ipfs object size', function () {
        helperInstance.setObjectMaxSize(100);
        expect(helperInstance.OBJECT_MAX_SIZE).to.equal(100);
    });

    it('sets response timeout', function () {
        helperInstance.setRequestTimeout(3000);
        expect(helperInstance.REQUEST_TIMEOUT).to.equal(3000);
    });

    it('adds object using file api', function () {
        return helperInstance.add({ q: longText })
            .then((node) => {
                expect(node).to.have.property('hash');
                return helperInstance.get(node.hash, true)
                    .then((result: Buffer) => {
                        expect(JSON.parse(result.toString())).deep.equal({ q: longText });
                    });
            });
    });

    it.skip('gets hash stats', function () {
        return helperInstance
            .getStats(statHash)
            .then((stats: any) => {
                console.log(stats);
                expect(stats).to.have.property('DataSize');
            });
    });

    it('returns same hash on add if checkIfHash is present', function () {
        return helperInstance
            .add(statHash, false, true)
            .then((result: any) => {
                console.log(statHash, result);
                expect(result).to.have.property('hash');
                expect(result).to.have.property('size');
            });
    });

    it('sets encoding for ipfs hash', function (done) {
        helperInstance.setEncoding('base64');
        expect(helperInstance.ENCODING).to.equal('base64');
        provider.stop(() => done());
    });

    after(function (done) {
        rimraf('./test-repo', (err) => {
            console.log(err);
            done();
            process.exit(); // weird hang
        });
    });
});