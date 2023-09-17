/*
- Alpha365 Compound - 
This strategy involves triggering the compound function on the vault contract every 24 hours in order to continue receiving the maximum payout rewards from the ROI dapp. A notification email report is then sent via email to update the status of the wallets. This compound bot supports multiple wallets and just loops through all of them. Just change the 'initWallets' code to the number you like!  

URL: https://app.alpha365.finance/vault/?ref=0xf280255dfffb8f8c5eb52153cc10565440fab100
*/

// Import required node modules
const scheduler = require("node-schedule");
const nodemailer = require("nodemailer");
const { ethers } = require("ethers");
const figlet = require("figlet");
require("dotenv").config();
const fs = require("fs");

// ABIs for the vault and pool contracts
const VAULT_ABI = require("./vaultABI");
const TKN_ABI = require("./tokenABI");

// Import the environment variables and contract addresses
const VAULT_ADR = "0xF5c27FaD680Ea584dc9973F80920D74aCc1290af";
const TKN_ADR = "0x5d75675E9DA82524B5DfBe3439Fe3a6E29f2b967";
const RPC_URL = process.env.BSC_RPC;

// Storage obj
var restakes = {
  previousRestake: "",
  nextRestake: "",
  prevGas: "",
  nextGas: "",
  count: 1,
};
var report = {};

// Main Function
const main = async () => {
  let restakeExists = false;
  try {
    // check if restake file exists
    if (!fs.existsSync("./restakes.json")) await storeData();

    // get stored values from file
    const storedData = JSON.parse(fs.readFileSync("./restakes.json"));
    console.log(storedData);

    // not first launch, check data
    if ("nextRestake" in storedData) {
      const nextRestake = new Date(storedData.nextRestake);
      restakes["nextGas"] = new Date(storedData["nextGas"]);
      restakes["count"] = new Number(storedData["count"]);

      // restore claims schedule
      if (nextRestake > new Date()) {
        console.log("Restored Restake: " + nextRestake);
        scheduler.scheduleJob(nextRestake, ALPHACompound);
        restakeExists = true;
      }
    }
  } catch (error) {
    console.error(error);
  }

  // first time, no previous launch
  if (!restakeExists) ALPHACompound();
};

// Import wallet detail
const initWallets = (n) => {
  let wallets = [];
  for (let i = 1; i <= n; i++) {
    let wallet = {
      address: process.env["ADR_" + i],
      key: process.env["PVK_" + i],
      vaultID: process.env["VID_" + i],
      index: i,
      referer: "",
      downline: "",
    };

    // allocate for a circular referral system (skip nth wallet)
    if (i === 1) wallet.referer = process.env["ADR_" + (n - 1)];
    else wallet.referer = process.env["ADR_" + (i - 1)];
    if (i >= n - 1) wallet.downline = process.env["ADR_" + 1];
    else wallet.downline = process.env["ADR_" + (i + 1)];

    wallets.push(wallet);
  }
  return wallets;
};

// Ethers connect on each wallet
const connect = async (wallet) => {
  let connection = {};

  // Add connection properties
  connection.provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  connection.wallet = new ethers.Wallet(wallet.key, connection.provider);
  connection.vault = new ethers.Contract(
    VAULT_ADR,
    VAULT_ABI,
    connection.wallet
  );
  connection.token = new ethers.Contract(TKN_ADR, TKN_ABI, connection.wallet);

  // connection established
  await connection.provider.getTransactionCount(wallet.address);
  return connection;
};

// ARK Compound Function
const ALPHACompound = async () => {
  // start function
  console.log("\n");
  console.log(
    figlet.textSync("ALPHACompound", {
      font: "Standard",
      horizontalLayout: "default",
      verticalLayout: "default",
      width: 80,
      whitespaceBreak: true,
    })
  );

  // get wallet detail from .env
  const wallets = initWallets(5);

  // storage array for sending reports
  report.title = "Alpha365 Report " + todayDate();
  report.actions = [];
  let balances = [];
  let promises = [];

  // check need to pay fees
  const today = new Date();
  const gasTime = new Date(restakes.nextGas);
  if (today > gasTime) {
    report.payFees = [];
    // loop through for each wallet
    for (const wallet of wallets) {
      console.log("payGas()");
    }

    // wait for all the promises to finish resolving
    const payments = await Promise.allSettled(promises);
    for (const payment of payments) {
      report.payFees.push(payment);
    }
    promises = [];
  }

  // store last compound date
  restakes.previousRestake = today.toString();
  const t = restakes["count"];
  restakes["count"] = t + 1;

  // claim on every 3rd time
  const claimTime = t % 3 == 0;

  // loop through for each wallet
  for (const wallet of wallets) {
    if (claimTime) {
      const action = claim(wallet);
      report.mode = "claim";
      promises.push(action);
    } else {
      const action = compound(wallet);
      report.mode = "compound";
      promises.push(action);
    }
  }

  // wait for all the promises to finish resolving
  const results = await Promise.allSettled(promises);
  for (const result of results) {
    try {
      const action = result.value;
      report.actions.push(action);
      if (action.balance) {
        balances.push(parseFloat(action.balance));
      }
    } catch (error) {
      console.error(error);
    }
  }

  // calculate the average wallet size
  const average = eval(balances.join("+")) / balances.length;
  report.consolidated = { average: average, target: "300 ALPHA" };

  // find the maximum timestamp of all
  const m = Math.max(...report.actions.map((o) => o.timestamp), 0);
  const s = Math.max(...report.actions.map((o) => o.gastime), 0);

  // store prev gas payment
  let gas = new Date(s * 1000);
  restakes.prevGas = gas.toString();

  // store next gas payment
  gas.setHours(gas.getHours + 24 * 7);
  restakes.nextGas = gas.toString();

  // schedule the next action date
  const date = new Date(m * 1000);
  scheduleNext(date);

  // send daily status report
  report.schedule = restakes;
  sendReport();
};

// Airdrop Individual Wallet [TODO]
const airdrop = async (wallet, tries = 1.0) => {
  const w = wallet.address.slice(0, 5) + "..." + wallet.address.slice(-6);
  /*try {
    console.log(`- Wallet ${wallet["index"]} -`);
    console.log("Airdroping...");

    // connection using the current wallet
    const connection = await connect(wallet);
    const nonce = await connection.provider.getTransactionCount(wallet.address);
    const m = Math.floor((60 * 60000) / tries);

    // set custom gasPrice
    const overrideOptions = {
      nonce: nonce,
      gasLimit: Math.floor(2000000 / tries),
      gasPrice: ethers.utils.parseUnits(tries.toString(), "gwei"),
    };

    // get the airdrop balance and the downline to send it to
    const val = await connection.vault.airdropBalance(wallet.address);
    console.log("Airdroping: " + val.toString());
    const addresses = [wallet.downline];
    const amounts = [val];

    // call airdrop function and await the results
    const result = await connection.vault.airdrop(
      addresses,
      amounts,
      overrideOptions
    );
    const airdropped = await connection.provider.waitForTransaction(
      result.hash,
      1,
      m
    );

    // succeeded
    if (airdropped) {
      const v = await connection.vault.airdropBalance(wallet.address);
      console.log(`Airdrop${wallet["index"]}: success`);
      const airdropBal = ethers.utils.formatEther(v);

      const success = {
        index: wallet.index,
        wallet: w,
        downline: addresses,
        airdropBal: airdropBal,
        airdrop: true,
        tries: tries,
      };

      // return status
      return success;
    }
  } catch (error) {
    console.log(`Wallet${wallet["index"]}: failed!`);
    console.error(error);

    // max 5 tries
    if (tries > 5) {
      // failed
      const failure = {
        index: wallet.index,
        wallet: w,
        airdrop: false,
        error: error,
      };

      // return status
      return failure;
    }

    // failed, retrying again...
    console.log(`retrying(${tries})...`);
    return await airdrop(wallet, ++tries);
  }*/
};

// Compound Individual Wallet
const compound = async (wallet, tries = 1.0) => {
  const w = wallet.address.slice(0, 5) + "..." + wallet.address.slice(-6);
  try {
    console.log(`- Wallet ${wallet["index"]} -`);
    console.log("Compounding...");

    // connection using the current wallet
    const connection = await connect(wallet);
    const nonce = await connection.provider.getTransactionCount(wallet.address);
    const m = Math.floor((60 * 60000) / tries);
    const vault_id = Number(wallet.vaultID);

    // set custom gasPrice
    const overrideOptions = {
      nonce: nonce,
      gasLimit: Math.floor(2000000 / tries),
      gasPrice: ethers.utils.parseUnits(tries.toString(), "gwei"),
    };

    // call the action function and await the results
    const result = await connection.vault.compound(vault_id, overrideOptions);
    const receipt = await connection.provider.waitForTransaction(
      result.hash,
      1,
      m
    );

    // succeeded
    if (receipt) {
      // get the principal balance currently in the vault
      const v = await connection.vault.allInvestment(vault_id);
      const balance = ethers.utils.formatEther(v.amountTokenInvested);
      const b = await connection.provider.getBalance(wallet.address);
      console.log(`Wallet${wallet["index"]}: success`);
      console.log(`Vault Balance: ${balance} ALPHA`);
      const bal = ethers.utils.formatEther(b);
      const date = Number(v.lastTimeCompound);
      const gas = Number(v.timePaidVaultGas);

      const success = {
        index: wallet.index,
        wallet: w,
        BNB: bal,
        balance: balance,
        compound: true,
        timestamp: date,
        gastime: gas,
        tries: tries,
      };

      // return status
      return success;
    }
  } catch (error) {
    console.log(`Wallet${wallet["index"]}: failed!`);
    console.error(error);

    // max 5 tries
    if (tries > 5) {
      // failed
      const failure = {
        index: wallet.index,
        wallet: w,
        compound: false,
        error: error,
      };

      // return status
      return failure;
    }

    // failed, retrying again...
    console.log(`retrying(${tries})...`);
    return await compound(wallet, ++tries);
  }
};

// Claim Individual Wallet
const claim = async (wallet, tries = 1.0) => {
  const w = wallet.address.slice(0, 5) + "..." + wallet.address.slice(-6);
  try {
    console.log(`- Wallet ${wallet["index"]} -`);
    console.log("Claiming...");

    // connection using the current wallet
    const connection = await connect(wallet);
    const nonce = await connection.provider.getTransactionCount(wallet.address);
    const m = Math.floor((60 * 60000) / tries);
    const vault_id = Number(wallet.vaultID);

    // set custom gasPrice
    const overrideOptions = {
      nonce: nonce,
      gasLimit: Math.floor(2000000 / tries),
      gasPrice: ethers.utils.parseUnits(tries.toString(), "gwei"),
    };

    // call the action function and await the results
    const result = await connection.vault.claim(vault_id, overrideOptions);
    const receipt = await connection.provider.waitForTransaction(
      result.hash,
      1,
      m
    );

    // succeeded
    if (receipt) {
      // get the principal balance currently in the vault
      const v = await connection.vault.allInvestment(vault_id);
      const balance = ethers.utils.formatEther(v.amountTokenInvested);
      const b = await connection.provider.getBalance(wallet.address);
      console.log(`Wallet${wallet["index"]}: success`);
      console.log(`Vault Balance: ${balance} ALPHA`);
      const bal = ethers.utils.formatEther(b);
      const date = Number(v.lastTimeCompound);
      const gas = Number(v.timePaidVaultGas);
      const drop = await airdrop(wallet);

      const success = {
        index: wallet.index,
        wallet: w,
        BNB: bal,
        balance: balance,
        claim: true,
        timestamp: date,
        gastime: gas,
        tries: tries,
        airdrop: drop,
      };

      // return status
      return success;
    }
  } catch (error) {
    console.log(`Wallet${wallet["index"]}: failed!`);
    console.error(error);

    // max 5 tries
    if (tries > 5) {
      // failed
      const failure = {
        index: wallet.index,
        wallet: w,
        claim: false,
        error: error,
      };

      // return status
      return failure;
    }

    // failed, retrying again...
    console.log(`retrying(${tries})...`);
    return await claim(wallet, ++tries);
  }
};

// Job Scheduler Function
const scheduleNext = async (nextDate) => {
  // set next job to be 24hrs 1min from now
  nextDate.setHours(nextDate.getHours() + 24);
  nextDate.setMinutes(nextDate.getMinutes() + 1);
  restakes.nextRestake = nextDate.toString();
  console.log("Next Restake: ", nextDate);

  // schedule next restake
  scheduler.scheduleJob(nextDate, ARKCompound);
  storeData();
  return;
};

// Data Storage Function
const storeData = async () => {
  const data = JSON.stringify(restakes);
  fs.writeFile("./restakes.json", data, (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Data stored:", restakes);
    }
  });
};

// Get ALPHA Price Function
const alphaPrice = async () => {
  return {
    dextools:
      "https://www.dextools.io/app/en/bnb/pair-explorer/0xaaa6a5aff2d6fa6d26d4ba18d76a4d9f3ac75aea",
  };
};

// Current Date function
const todayDate = () => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// Send Report Function
const sendReport = async () => {
  try {
    // get the formatted date
    const today = todayDate();
    report.title = "Alpha365 Report " + today;

    // get price of Furio
    const price = await alphaPrice();
    report.price = price;

    // configure email server
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_ADDR,
        pass: process.env.EMAIL_PW,
      },
    });

    // setup mail params
    const mailOptions = {
      from: process.env.EMAIL_ADDR,
      to: process.env.RECIPIENT,
      subject: "Alpha365 Report: " + today,
      text: JSON.stringify(report, null, 2),
    };

    // send the email message
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });

    // clear var
    report = {};
  } catch (error) {
    console.error(error);
  }
};

main();
