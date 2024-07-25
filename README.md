# Blockchain Analyzer

Blockchain Analyzer is a NestJS-based application for analyzing blockchain transactions and token transfers. It uses Prisma as ORM and supports PostgreSQL for storing data.

## Features

- Fetch and store blockchain transactions for a specific address.
- Fetch and store token transfers for a specific address or contract address.
- Analyze affiliated addresses based on transactions.
- Check token transfer relations between addresses.

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js (>= 14.x)
- PostgreSQL database
- Yarn or npm

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/blockchain-analyzer.git
cd blockchain-analyzer
````

2. Install dependencies:

```bash
yarn install
# or
npm install
````
3. Set up your environment variables by creating a .env file in the root directory with the following content:
```
DATABASE_URL="postgresql://<username>:<password>@<host>:<port>/<database>?schema=public"
ETH_API_KEY="<your_etherscan_api_key>"
````
4. Migrate your database:
```bash
npx prisma migrate dev --name init
````
5. Generate Prisma client:
```bash
npx prisma generate
````
## Running the Application
To start the application, run:
```bash
yarn start
# or
npm start
````
The application will be available at http://localhost:3000.

To open Prisma Studio:
```bash
npx prisma studio
````
To run script from *scripts* folder use
```bash
npx ts-node scripts/*script-name*.ts
````


## Endpoints
### Fetch and Store Data
Fetch and store all transactions for a specific address.
* `POST /blockchain/transactions/all-in-out/:address`

Fetch and store all token transfers for a specific address.
* `GET /blockchain/token-transfers/from-address/list/:address`

Fetch and store all token transfers for a specific contract address.
* `GET /blockchain/token-transfers/from-contract/list/:contractaddress`

Fetch and store all token transfers for a specific token and address.
* `GET /blockchain/token-transfers/token-from-address/list/:tokenaddress/:address`

### Analysis
Analyze and find affiliated addresses based on transactions.
* `GET /blockchain/analisys/affiliates/:address/:range`

Check token transfer relations between addresses.
* `GET /blockchain/token-transfers/relations/:address/:target`

### Database Management
Get the count of stored transactions.
* `GET /blockchain/analisys/transactions/count`

Get the count of stored token transfers.
* `GET /blockchain/analisys/token-transfers/count`

To start API in dev mode run:
```bash
npm run start:dev
```
