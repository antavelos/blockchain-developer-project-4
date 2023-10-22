import config from './config.json';
import * as utils from '../utils.js';
import DOM from './dom';
import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Web3 from "web3";
import moment from "moment";

const parseError = err => {
  try {
    const msg = err.message.split('message')[1].split('code')[0].slice(3).slice(0, -3);
    return msg.replace("VM Exception while processing transaction: revert", "");
  } catch {
    return err.message;
  }
};

const App = {
  web3: null,
  currentAccount: null,
  meta: null,
  flightSuretyApp: null,
  flightSuretyData: null,
  flightsListEl: DOM.elid("flights-list"),
  flightCodes: [],
  flights: {},
  currentFlightCode: null,
  airlineAccounts: [],
  airlines: {},
  insurances: {},

  buyInsuranceModal: new bootstrap.Modal('#buyInsuranceModal'),
  $buyInsuranceFlightCode: DOM.elid('buyInsuranceFlightCode'),
  $buyInsurancePrice: DOM.elid('buyInsurancePrice'),
  registerFlightModal: new bootstrap.Modal('#registerFlightModal'),
  $registerFlightCode: DOM.elid("registerFlightCode"),
  registerAirlineModal: new bootstrap.Modal('#registerAirlineModal'),
  $registerAirlineName: DOM.elid("registerAirlineName"),
  $registerAirlineAddress: DOM.elid("registerAirlineAddress"),
  fundAirlineModal: new bootstrap.Modal('#fundAirlineModal'),
  $fundAirlineAmount: DOM.elid("fundAirlineAmount"),
  $fundAirlineButton: DOM.elid("fundAirlineButton"),

  statusCodes: {
    STATUS_CODE_UNKNOWN: 0,
    STATUS_CODE_ON_TIME: 10,
    STATUS_CODE_LATE_AIRLINE: 20,
    STATUS_CODE_LATE_WEATHER: 30,
    STATUS_CODE_LATE_TECHNICAL: 40,
    STATUS_CODE_LATE_OTHER: 50,
  },

  errorToast: new bootstrap.Toast('#errorToast'),
  $errorToastBody: DOM.elid('errorToastBody'),
  successToast: new bootstrap.Toast('#successToast'),
  $successToastBody: DOM.elid('successToastBody'),
  infoToast: new bootstrap.Toast('#infoToast'),
  $infoToastBody: DOM.elid('infoToastBody'),

  showErrorToast: (message) => {
    App.$errorToastBody.setHTML(message);
    App.errorToast.show();
  },

  showSuccessToast: (message) => {
    App.$successToastBody.setHTML(message);
    App.successToast.show();
  },
  showInfoToast: (message) => {
    App.$infoToastBody.setHTML(message);
    App.infoToast.show();
  },
  initContracts: () => {
    App.flightSuretyApp = new App.web3.eth.Contract(FlightSuretyApp.abi, config.contracts.app);
    App.flightSuretyData = new App.web3.eth.Contract(FlightSuretyData.abi, config.contracts.data);
  },
  start: async () => {
    App.initContracts();
    App.updateDOM();
    App.setupDomEvents();
    App.setupBlockchainEvents();
  },
  updateDOM() {
    App.getFlightsData()
    .then((data) => {
      let i = 0;
      App.flightCodes.forEach((fc) => {
        App.flights[fc] = {...data[i]};
        i++;
      })

      return App.getAirlinesData();
    })
    .then(data => {
      let i = 0;
      App.airlineAccounts.forEach((a) => {
        App.airlines[a] = {...data[i]};
        i++;
      })

      if (!Array.from(App.airlineAccounts).includes(App.currentAccount)) {
        DOM.elid("airlineActionsDropdown").style["display"] = "none";
      } else {
        DOM.elid("airlineActionsDropdown").style["display"] = "block";

        if (App.airlines[App.currentAccount].hasFunded) {
          App.$fundAirlineButton.classList.add("disabled")
        }
      }


      return App.getFlightInsuranceData();
    })
    .then(data => {
      let i = 0;
      App.flightCodes.forEach((fc) => {
        App.insurances[fc] = {...data[i]};
        i++;
      })

      // finally render the data
      App.renderFlights(App.flights);
    })
    .catch(err => {
      App.showErrorToast("Failed to retrieve flight data");
      console.error(err);
    });
  },
  getAirlinesData: async () => {
    App.airlineAccounts = new Set(Object.values(App.flights).map(f => (f.airline.toLowerCase())));
    return Promise.all(
      Array.from(App.airlineAccounts).map((a) => App.flightSuretyApp.methods.getAirlineData(a).call())
    );
  },
  getFlightInsuranceData: async () => {
    return Promise.all(
      App.flightCodes.map((fc) => App.flightSuretyApp.methods.getFlightInsuranceData(App.currentAccount, fc).call())
    );
  },
  getFlightsData: async () => {
    App.flightCodes = [];
    App.flightCodes = await App.flightSuretyApp.methods.getFlightCodes().call();

    return Promise.all(
      App.flightCodes.map((fc) => App.flightSuretyApp.methods.getFlightData(fc).call())
    );
  },
  fundAirline: () => {
    const amount = App.$fundAirlineAmount.value;
    App.flightSuretyApp.methods.fundAirline().send({from: App.currentAccount, value: utils.ethToWei(parseInt(amount))})
    .then(() => {
      App.fundAirlineModal.hide();
      App.showSuccessToast("Your funding was submitted successfully");
    })
    .catch(err => {
      App.fundAirlineModal.hide();
      App.showErrorToast(`Failed submit funding`);
      console.error(err);
    });
  },
  registerAirline: () => {
    const name = App.$registerAirlineName.value;
    const address = App.$registerAirlineAddress.value;
    App.flightSuretyApp.methods.registerAirline(address, name).send({from: App.currentAccount})
    .then(() => {
      App.registerAirlineModal.hide();
      App.showSuccessToast("Your vote has been registered");
    })
    .catch(err => {
      App.registerAirlineModal.hide();
      App.showErrorToast(`Failed to vote for new airline: ${parseError(err)}`);
      console.error(err);
    });
  },
  registerFlight: () => {
    const flightCode = App.$registerFlightCode.value;
    App.flightSuretyApp.methods.registerFlight(flightCode).send({from: App.currentAccount})
    .then(() => {
      App.registerFlightModal.hide();
      App.showSuccessToast("Flight was successfully registered");
      App.updateDOM();
    })
    .catch(err => {
      console.log(err);
      App.registerFlightModal.hide();
      App.showErrorToast(`Failed to register flight: ${parseError(err)}`);
      console.error(err);
    });
  },
  buyInsurance: () => {
    const value = utils.ethToWei(parseInt(App.$buyInsurancePrice.value));
    App.flightSuretyApp.methods.buyInsurance(App.currentFlightCode).send(
      {
        from: App.currentAccount,
        value
      })
    .then(() => {
      App.buyInsuranceModal.hide();
      App.showSuccessToast("Insurance was successfully bought");
      App.insurances[App.currentFlightCode].amount = value;
      App.renderFlights(App.flights);
    })
    .catch(err => {
      App.buyInsuranceModal.hide();
      App.showErrorToast("Failed to retrieve flight data");
      console.error(err);
    });
  },
  withdrawRefund: (flightCode) => {
    App.flightSuretyApp.methods.withdrawInsuranceRefund(flightCode).send({from: App.currentAccount})
    .then(() => {
      App.insurances[flightCode].refundWithdrawn = true;
      App.renderFlights(App.flights);
    })
    .catch(err => {
      App.showErrorToast("Failed to withdraw refund");
      console.error(err);
    })
  },
  fetchFlightStatus: (flightCode) => {
    const timestamp = utils.now();
    App.flightSuretyApp.methods.fetchFlightStatus(flightCode, timestamp).send({from: App.currentAccount})
    .then(() => {
      App.flights[App.currentFlightCode].flightStatusLoading = true;
      App.renderFlights(App.flights);
    })
    .catch(err => {
      App.showErrorToast(`Failed to request flight status for flight ${flightCode}`);
      console.error(err);
    })
  },
  createFlightListItem: (flightCode, flightData) => {
    let listItem = DOM.a({
      href: "#",
      className: "list-group-item"
    });

    let topDiv = listItem.appendChild(DOM.div({
      className: "d-flex w-100 justify-content-between"
    }));
    topDiv
      .appendChild(DOM.h5({className: "mb-1"}))
      .appendChild(DOM.strong())
      .appendChild(DOM.text(flightCode));

    const insuranceData = App.insurances[flightCode]
    let insuranceStatus = "";
    if (insuranceData.refundWithdrawn) {
      insuranceStatus = "Refunded"
    } else if (insuranceData.refundAmount > 0) {
      insuranceStatus = "Refund credited";
    } else if (insuranceData.amount > 0) {
      insuranceStatus = "Insured";
    }
    if (insuranceStatus.length > 0) {
      let insuranceStatusArea = topDiv
        .appendChild(DOM.small())
        .appendChild(DOM.strong());
      insuranceStatusArea.appendChild(DOM.text(insuranceStatus.toUpperCase()));
      if (insuranceData.refundAmount > 0 && !insuranceData.refundWithdrawn) {
        insuranceStatusArea
          .appendChild(DOM.button({className: "btn btn-sm btn-warning ms-1", id: `withdraw-button_${flightCode}`}))
          .appendChild(DOM.text("Withdraw"));
      }
    }

    let middleP = listItem.appendChild(DOM.p({className: "mb-1"}));
    middleP.appendChild(DOM.strong()).appendChild(DOM.text(`Airline: `))
    middleP.appendChild(DOM.text(App.airlines[flightData.airline.toLowerCase()].name))

    let airlineBadge = middleP.appendChild(DOM.span({className: "badge bg-light ms-1"}))
    airlineBadge.setAttribute("data-bs-toggle", "tooltip");
    airlineBadge.setAttribute("data-bs-placement", "top");
    airlineBadge.setAttribute("data-bs-title", flightData.airline);
    airlineBadge.appendChild(DOM.code(utils.shortenAddress(flightData.airline)));

    const statusDetails = App.getStatusDetails(flightData.statusCode);
    let statusArea = listItem.appendChild(DOM.span());
    statusArea.appendChild(DOM.strong()).appendChild(DOM.text("Status:"));

    if (flightData.statusCode == App.statusCodes.STATUS_CODE_UNKNOWN) {
      statusArea
        .appendChild(DOM.span({ className: "badge bg-secondary ms-1" }))
        .appendChild(DOM.text(statusDetails.status));
    } else {
      let status = statusArea.appendChild(DOM.span({
        className: flightData.statusCodeVerified ? "badge bg-success ms-1" : "badge bg-warning ms-1"
      }));
      if (!flightData.statusCodeVerified) {
        status.style["color"] = "black";
      }
      status.setAttribute("data-bs-toggle", "tooltip");
      status.setAttribute("data-bs-placement", "top");
      status.setAttribute("data-bs-title", flightData.statusCodeVerified ? "Verified" : "Not verified");
      status.appendChild(DOM.text(statusDetails.status));
      status.appendChild(DOM.i({className: flightData.statusCodeVerified ? "bi bi-check-circle-fill ms-1" : "bi bi-exclamation-triangle ms-1"}));
    }
    if (statusDetails.reason.length > 0) {
      statusArea
        .appendChild(DOM.i())
        .appendChild(DOM.text(` due to ${statusDetails.reason}`));
    }
    statusArea
      .appendChild(DOM.small())
      .appendChild(DOM.strong())
      .appendChild(DOM.text(` (${moment(parseInt(flightData.updatedTimestamp) * 1000).startOf('minute').fromNow()})`));

    const insurance = App.insurances[flightCode];

    let insuranceButton = listItem.appendChild(DOM.button({
      className: "btn btn-sm btn-primary insurance-button ms-2",
      id: `insurance-button_${flightCode}`,
    }));
    insuranceButton.appendChild(DOM.text("Buy insurance"));
    insuranceButton["disabled"] = flightData.statusCodeVerified;

    let fetchStatusButton = listItem.appendChild(DOM.button({
      className: "btn btn-sm btn-secondary",
      id: `fetch-status-button_${flightCode}`
    }))
    fetchStatusButton.style["float"] = "right";
    fetchStatusButton["disabled"] = flightData.statusCodeVerified;

    if (flightData.flightStatusLoading) {
      fetchStatusButton.appendChild(DOM.span({className: "spinner-border spinner-border-sm me-1"}))
      fetchStatusButton
        .appendChild(DOM.span({role: "status"}))
        .appendChild(DOM.text("Fetching..."));
    } else {
      fetchStatusButton.appendChild(DOM.text("Fetch status"));
    }

    return listItem;
  },
  getTimeFromTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);

    return date.toLocaleTimeString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  },
  getStatusDetails: (statusCode) => {
    if (statusCode == App.statusCodes.STATUS_CODE_UNKNOWN) {
      return { status: "UNKNOWN", reason: "" };
    } else if (statusCode == App.statusCodes.STATUS_CODE_LATE_AIRLINE) {
      return { status: "DELAYED", reason: "airline fault" };
    } else if (statusCode == App.statusCodes.STATUS_CODE_LATE_TECHNICAL) {
      return { status: "DELAYED", reason: "technical reasons" };
    } else if (statusCode == App.statusCodes.STATUS_CODE_LATE_WEATHER) {
      return { status: "DELAYED", reason: "weather conditions" };
    } else if (statusCode == App.statusCodes.STATUS_CODE_ON_TIME) {
      return { status: "ON TIME", reason: "" };
    } else if (statusCode == App.statusCodes.STATUS_CODE_LATE_OTHER) {
      return { status: "DELAYED", reason: "unknown reason" };
    }
  },
  renderFlights: (flights) => {
    App.flightsListEl.innerHTML = "";

    Object.keys(flights).forEach(flightCode => {
      const flightListItem = App.createFlightListItem(flightCode, flights[flightCode]);
      App.flightsListEl.appendChild(flightListItem);
    });

    App.updateButtonsEvents();

    App._initTooltips();
  },
  updateButtonsEvents: () => {
    App.flightCodes.forEach(fc => {
      try {
        DOM.elid(`insurance-button_${fc}`).addEventListener('click', () => {
          App.currentFlightCode = fc;
          App.$buyInsuranceFlightCode.value = fc;
          App.buyInsuranceModal.show();
        });
      } catch {} // swallow errors of not existing buttons

      try {

        DOM.elid(`withdraw-button_${fc}`).addEventListener('click', () => {
          App.withdrawRefund(fc);
        });
      } catch {} // swallow errors of not existing buttons

      try {
        DOM.elid(`fetch-status-button_${fc}`).addEventListener('click', () => {
          App.currentFlightCode = fc;
          App.fetchFlightStatus(fc);
        });
      } catch {} // swallow errors of not existing buttons
    })
  },
  setupBlockchainEvents() {
    App.flightSuretyApp.events.FlightStatusReceived((error, event) => {
      const data = event.returnValues;
      console.log("Received FlightStatusReceived:", data);
      App.flights[data.flightCode].statusCode = data.statusCode;
      App.flights[data.flightCode].statusCodeVerified = data.verified;
      App.flights[data.flightCode].updatedTimestamp = data.timestamp;
      App.flights[data.flightCode].flightStatusLoading = false;
      App.renderFlights(App.flights);
    });

    App.flightSuretyApp.events.FlightInsuranceRefundCredited((error, event) => {
      const data = event.returnValues;
      console.log("Received FlightInsuranceRefundCredited:", data);
      if (data.passenger.toLowerCase() == App.currentAccount.toLowerCase()) {
        App.showInfoToast(`A refund has been credited to your account due to delay of flight: ${data.flightCode}`);
        App.insurances[data.flightCode].refundAmount = data.refundAmount;
        App.renderFlights(App.flights);
      }
    })
  },
  setupDomEvents: () => {
    DOM.elid("buyInsuranceConfirmButton").addEventListener("click", App.buyInsurance);
    DOM.elid("registerAirlineButton").addEventListener("click", () => {
      App.registerAirlineModal.show();
    });
    DOM.elid("registerAirlineConfirmButton").addEventListener("click", App.registerAirline);
    DOM.elid("registerFlightButton").addEventListener("click", () => {
      App.registerFlightModal.show();
    });
    DOM.elid("registerFlightConfirmButton").addEventListener("click", App.registerFlight);
    DOM.elid("fundAirlineButton").addEventListener("click", () => {
      App.fundAirlineModal.show();
    });
    DOM.elid("fundAirlineConfirmButton").addEventListener("click", App.fundAirline);
  },
  _initTooltips: () => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
  }
};

window.App = App;

window.addEventListener("load", async () => {
  if (window.ethereum) {
    // use MetaMask's provider
    App.web3 = new Web3(window.ethereum);
    window.ethereum.enable(); // get permission to access accounts

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    App.currentAccount = accounts[0].toLowerCase();

    window.ethereum.on('accountsChanged', async (accounts) => {
      App.currentAccount = accounts[0];
      console.log('Account changed: ', App.currentAccount.toLowerCase());
      App.updateDOM();
    });
  } else {
    console.warn(
      "No web3 detected. Falling back to http://127.0.0.1:8545. You should remove this fallback when you deploy live",
    );
    App.web3 = new Web3(new Web3.providers.WebsocketProvider(config.provider.replace('http', 'ws')));
  }

  await App.start();
});
