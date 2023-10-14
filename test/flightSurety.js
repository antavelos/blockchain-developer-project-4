
const Test = require('../config/testConfig.js');
const web3 = require('web3');


const assertErrorReason = (err, message) => {
  if (Object.keys(err).includes('reason')) {
    assert.equal(err.reason, message);
  } else if (Object.keys(err.data).includes('reason')) {
    assert.equal(err.data.reason, message);
  } else {
    assert.equal(Object.values(err.data)[0].reason, message);
  }
}

const ethToWei = (eth) => web3.utils.toWei(`${eth}`, "ether");

contract('Flight Surety Tests', async (accounts) => {

  let config = {};
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address, {from: config.owner});
    await config.flightSuretyData.authorizeCaller(config.owner, {from: config.owner});
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`should have initial operational status: 'true'`, async function () {

    const status = await config.flightSuretyApp.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`should not allow non-Contract Owner accounts to change the operational status`, async () => {

    const statusBefore = await config.flightSuretyApp.isOperational.call();
    try{
        await config.flightSuretyApp.setOperatingStatus(!statusBefore, { from: config.testAddresses[2] });
    }
    catch(err) {
      assertErrorReason(err, "Caller is not contract owner");
    }
    const statusAfter = await config.flightSuretyApp.isOperational.call();

    assert.equal(statusBefore, statusAfter, "Status should not have changed");

  });

  it(`should allow Contract Owner account to change the operational status`, async () => {

    const statusBefore = await config.flightSuretyApp.isOperational.call();

    await config.flightSuretyApp.setOperatingStatus(!statusBefore, {from: config.owner});

    const statusAfter = await config.flightSuretyApp.isOperational.call();

    assert.notEqual(statusBefore, statusAfter, "Status should have changed");

  });

  /****************************************************************************************/
  /* Airlines                                                                             */
  /****************************************************************************************/

  it('should register first airline upon deployment', async () => {
    const airlinesCount = await config.flightSuretyData.getAirlinesCount();

    assert.equal(airlinesCount, 1, 'No airlines were registered upon deployment');

    const data = await config.flightSuretyData.getAirlineData(config.firstAirline.account);
    assert.equal(data.name, config.firstAirline.name, 'First airline name does not match');
    assert.equal(data.funding, 0, 'First airline funding should be 0 ETH');
  });

  it('FlightSuretyData.getAirlineData() should fail when called by unauthorized caller', async () => {
    try {
      await config.flightSuretyData.getAirlineData(config.firstAirline.account, {from: config.testAddresses[0]});
    } catch(err) {
      assertErrorReason(err, "Caller is not authorized");
    }
  });

  it('FlightSuretyData.getAirlineData() should return the requested airline', async () => {
    const data = await config.flightSuretyData.getAirlineData(config.firstAirline.account);

    assert.equal(data.name, config.firstAirline.name, 'First airline name does not match');
    assert.equal(data.funding, 0, 'First airline funding should be 0 ETH');
  });

  it('FlightSuretyData.getAirlineNames() should fail when called by unauthorized caller', async () => {
    try {
      await config.flightSuretyData.getAirlineNames({from: config.testAddresses[0]});
    } catch(err) {
      assertErrorReason(err, "Caller is not authorized");
    }
  });

  it('FlightSuretyData.getAirlineNames() should return all the airlines', async () => {
    const airlines = await config.flightSuretyData.getAirlineNames();

    assert.equal(airlines.length, 1, 'No airlines were found');
  });

  it('FlightSuretyData.addAirline() should fail when called by unauthorized caller', async () => {
    try {
      await config.flightSuretyData.addAirline(config.testAddresses[0], 'Airline', {from: config.testAddresses[1]});
    } catch(err) {
      assertErrorReason(err, "Caller is not authorized");
    }
  });

  it('FlightSuretyData.addAirline() should add a new airline', async () => {
    const airline = {
      account: config.testAddresses[0],
      name: 'Second Airline',
      funding: 0
    }

    await config.flightSuretyData.addAirline(airline.account, airline.name);

    const airlinesCount = await config.flightSuretyData.getAirlinesCount();

    assert.equal(airlinesCount, 2, '2 airlines should be registered');

    const data = await config.flightSuretyData.getAirlineData(config.testAddresses[0]);

    assert.equal(data.name, airline.name, 'Second airline name does not match');
    assert.equal(data.funding, airline.funding, 'Second airline funding should be 0 ETH');
  });

  it('FlightSuretyData.updateAirlineFunding() should fail when called by unauthorized caller', async () => {
    try {
      await config.flightSuretyData.updateAirlineFunding(config.firstAirline.account, 1, {from: config.testAddresses[1]});
    } catch(err) {
      assertErrorReason(err, "Caller is not authorized");
    }
  });

  it('FlightSuretyData.updateAirlineFunding() should update the airline funding', async () => {

    let airline = await config.flightSuretyData.getAirlineData(config.firstAirline.account);
    const fundingBeforeUpdate = parseInt(airline.funding);

    let funding = 3
    await config.flightSuretyData.updateAirlineFunding(config.firstAirline.account, funding);

    airline = await config.flightSuretyData.getAirlineData(config.firstAirline.account);
    const fundingAfterUpdate = parseInt(airline.funding);

    assert.equal(fundingAfterUpdate, fundingBeforeUpdate + funding);

    funding = -3;
    await config.flightSuretyData.updateAirlineFunding(config.firstAirline.account, funding);

    airline = await config.flightSuretyData.getAirlineData(config.firstAirline.account);
    const fundingAfterSecondUpdate = parseInt(airline.funding);

    assert.equal(fundingAfterSecondUpdate, fundingAfterUpdate + funding);
  });

  it('FlightSuretyApp.fundAirline() should fail if called by not registered airline', async () => {
    try {
      await config.flightSuretyApp.fundAirline(1, {from: config.testAddresses[1]});
    } catch(err) {
      assertErrorReason(err, "Caller is not a registered airline");
    }
  });

  it('FlightSuretyApp.fundAirline() should update the airline funding', async () => {

    let airline = await config.flightSuretyData.getAirlineData(config.firstAirline.account);
    const fundingBeforeUpdate = parseInt(airline.funding);

    let funding = 3
    await config.flightSuretyApp.fundAirline(funding, {from: config.firstAirline.account});

    airline = await config.flightSuretyData.getAirlineData(config.firstAirline.account);
    const fundingAfterUpdate = parseInt(airline.funding);

    assert.equal(fundingAfterUpdate, fundingBeforeUpdate + funding);

    funding = -3;
    await config.flightSuretyApp.fundAirline(funding, {from: config.firstAirline.account});

    airline = await config.flightSuretyData.getAirlineData(config.firstAirline.account);
    const fundingAfterSecondUpdate = parseInt(airline.funding);

    assert.equal(fundingAfterSecondUpdate, fundingAfterUpdate + funding);
  });

  it('FlightSuretyApp.registerAirline() should fail when contract is not operational', async () => {
    const airline = {
      account: config.testAddresses[1],
      name: 'Third Airline',
      funding: 0
    }

    await config.flightSuretyApp.setOperatingStatus(false);
    try {
      await config.flightSuretyApp.registerAirline(airline.account, airline.name);
    } catch(err) {
      assertErrorReason(err, "Contract is not currently operational");
    }

    // make contract operational again
    await config.flightSuretyApp.setOperatingStatus(true);
  });

  it('FlightSuretyApp.registerAirline() should fail when calling account is not registered airline', async () => {
    const airline = {
      account: config.testAddresses[1],
      name: 'Third Airline',
      funding: 0
    }
    try {
      await config.flightSuretyApp.registerAirline(airline.account, airline.name, {from: config.testAddresses[5]});
    } catch(err) {
      assertErrorReason(err, "Caller is not a registered airline");
    }
  });

  it('FlightSuretyApp.registerAirline() should fail when calling account has not funded enough', async () => {
    const airline = {
      account: config.testAddresses[1],
      name: 'Third Airline',
      funding: 0
    }
    try {
      await config.flightSuretyApp.registerAirline(airline.account, airline.name, {from: config.firstAirline.account});
    } catch(err) {
      assertErrorReason(err, "Caller has not submitted sufficient funding yet");
    }
  });

  it('FlightSuretyApp.registerAirline() should fail when new airline is already registered', async () => {
    const airline = {
      account: config.firstAirline.account,
      name: 'Third Airline',
      funding: 0
    }
    await config.flightSuretyApp.fundAirline(ethToWei(10), {from: config.firstAirline.account});
    try {
      await config.flightSuretyApp.registerAirline(airline.account, airline.name, {from: config.firstAirline.account});
    } catch(err) {
      assertErrorReason(err, "Airline is already registered");
    }
  });

  it('FlightSuretyApp.registerAirline() new airline should be registered when existing airlines are < 4', async () => {
    const airline = {
      account: config.testAddresses[1],
      name: 'Third Airline',
      funding: 0
    }

    const currentAirlinesNum = parseInt(await config.flightSuretyData.getAirlinesCount());
    assert.isTrue(currentAirlinesNum < 5, "current number of airlines is >= 5");

    await config.flightSuretyApp.registerAirline(airline.account, airline.name, {from: config.firstAirline.account});

    const airlinesCount = await config.flightSuretyData.getAirlinesCount();
    assert.equal(airlinesCount, currentAirlinesNum + 1, "new airline was not registered");
  });

  it('FlightSuretyApp.registerAirline() new airline requires consensus when existing airlines are >= 4', async () => {
    const fourthAirline = {
      account: config.testAddresses[2],
      name: 'Fourth Airline',
      funding: 0
    }

    // register a fourth airline in order to continue with concesus
    await config.flightSuretyApp.registerAirline(fourthAirline.account, fourthAirline.name, {from: config.firstAirline.account});
    const airlinesCountBefore = (await config.flightSuretyData.getAirlinesCount()).toNumber();
    console.log(airlinesCountBefore);
    assert.isTrue(airlinesCountBefore === 4, "current number of airlines is not 4");

    const fifthAirline = {
      account: config.testAddresses[3],
      name: 'Fifth Airline',
      funding: 0
    }

    // first attempt should get 25% concensus
    await config.flightSuretyApp.fundAirline(ethToWei(10), {from: config.testAddresses[0]});
    await config.flightSuretyApp.registerAirline(fifthAirline.account, fifthAirline.name, {from: config.testAddresses[0]});

    let airlinesCountAfter = await config.flightSuretyData.getAirlinesCount();
    assert.equal(airlinesCountAfter, airlinesCountBefore, "new airline should not be registered yet");

    // prevent revoting
    try {
      await config.flightSuretyApp.registerAirline(fifthAirline.account, fifthAirline.name, {from: config.testAddresses[0]});
    } catch(err) {
      assertErrorReason(err, "Caller has alredy voted for the candidate airline")
    }

    // first attempt should get 50% concensus
    await config.flightSuretyApp.fundAirline(ethToWei(10), {from: config.testAddresses[1]});
    await config.flightSuretyApp.registerAirline(fifthAirline.account, fifthAirline.name, {from: config.testAddresses[1]});

    airlinesCountAfter = await config.flightSuretyData.getAirlinesCount();
    assert.equal(airlinesCountAfter, airlinesCountBefore + 1, "new airline should have been registered");
  });
});
