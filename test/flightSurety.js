
const Test = require('../config/testConfig.js');
const BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  let config = {};
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`should have initial operational status: 'true'`, async function () {

    const status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`should not allow non-Contract Owner accounts to change the operational status`, async () => {

    const statusBefore = await config.flightSuretyApp.isOperational.call();
    try{
        await config.flightSuretyData.setOperatingStatus(!statusBefore, { from: config.testAddresses[2] });
    }
    catch(err) {
      assert(err.reason, 'Caller is not contract owner');
    }
    const statusAfter = await config.flightSuretyApp.isOperational.call();

    assert.equal(statusBefore, statusAfter, "Status should not have changed");

  });

  it(`should allow Contract Owner account to change the operational status`, async () => {

    const statusBefore = await config.flightSuretyApp.isOperational.call();

    await config.flightSuretyData.setOperatingStatus(!statusBefore, {from: config.owner});

    const statusAfter = await config.flightSuretyApp.isOperational.call();

    assert.notEqual(statusBefore, statusAfter, "Status should have changed");

  });


});
