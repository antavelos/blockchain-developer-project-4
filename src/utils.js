const web3 = require('web3');


const assertErrorReason = (err, message) => {
  assert.isFalse(err === undefined, "Should fail");

  if (Object.keys(err).includes('reason')) {
    assert.equal(err.reason, message);
    return;
  }
  if (Object.keys(err).includes('data')) {

    if (Object.keys(err.data).includes('reason')) {
      assert.equal(err.data.reason, message);
    } else {
      assert.equal(Object.values(err.data)[0].reason, message);
    }
    return;
  }

  assert.isTrue(false, "error log not found");
  console.log(err);
}

const assertContractCallError = async (methodPromise, expectedErrorMessage) => {
  let error;
  try{
      await methodPromise;
  }
  catch(err) {
    error = err;
  }
  assertErrorReason(error, expectedErrorMessage);
}

const randomStr = (n) => Math.random().toString(16).substring(2, 2 + n).toUpperCase();

const ethToWei = (eth) => web3.utils.toWei(`${eth}`, "ether");

const now = () => Math.floor(Date.now() / 1000);


const randomInt = (upTo) => Math.floor(Math.random() * upTo);

const shortenAddress = (address) => `${address.substr(0, 5)}...${address.substr(-3)}`;

const cleanError = err => {
  try {
    const msg = err.message.split('message')[1].split('code')[0].slice(3).slice(0, -3);
    return msg.replace("VM Exception while processing transaction: revert", "");
  } catch {
    return err.message;
  }
};

module.exports = {
    assertErrorReason,
    assertContractCallError,
    randomStr,
    randomInt,
    cleanError,
    ethToWei,
    now,
    shortenAddress,
};