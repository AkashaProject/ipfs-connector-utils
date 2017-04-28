import IpfsApiHelper from './index';
import * as IPFS from 'ipfs';
import { expect } from 'chai';
describe('ipfs-connector-utils', function(){
    let helperInstance: IpfsApiHelper;
    this.timeout(4000);

    before(function(done) {
        const provider = new IPFS({repo: 'test-repo'});
        provider.on('start', () => {
            helperInstance = new IpfsApiHelper(provider);
        });
        setTimeout(() => {
         expect(helperInstance).to.exist;
         done();
        }, 2000);
    });

    it('adds an object to ipfs', function () {
        return helperInstance.add({data: '{}'})
            .then((node) => {
            console.log(node);
                expect(node.hash).to.exist;
                helperInstance.get(node.hash).then((data1: any) => {
                    expect(data1).to.have.property('data');
                    expect(data1.data).to.equal('{}');
                })
            });
    });
    
});