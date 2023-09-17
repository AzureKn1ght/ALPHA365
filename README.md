# Alpha365 Compound
![Alpha365](https://alpha365.finance/public/assets/pc.webp)


## Strategy 
Simple Bot to Restake tokens every 24h. Creating compound interest with the tokens. 

This strategy involves triggering the compound function on the vault contract every 24 hours in order to continue receiving the maximum payout rewards from the ROI dapp. A notification email report is then sent via email to update the status of the wallets. This compound bot supports multiple wallets and just loops through all of them. Just change the *initWallets* code to the number you like!  

URL: https://app.alpha365.finance/vault/?ref=0xab951ec23283ee00ae0a575b89ddf40df28e23ab \
Donate: 0xFdD831b51DCdA2be256Edf12Cd81C6Af79b6D7Df

# ENV Variables 
You will need to create a file called *.env* in the root directory, copy the text in *.env.example* and fill in the variables 


# How to Run 
You could run it on your desktop just using [Node.js](https://github.com/nodejs/node) in your terminal. However, on a production environment, it is recommended to use something like [PM2](https://github.com/Unitech/pm2) to run the processes to ensure robust uptime and management. 

### ALPHA Compound
```
pm2 start alpha365.js -n "ALPHA"
pm2 save

```
