-- CreateTable
CREATE TABLE "Transaction" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "blockNumber" TEXT NOT NULL,
    "timeStamp" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "transactionIndex" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "gas" TEXT NOT NULL,
    "gasPrice" TEXT NOT NULL,
    "isError" TEXT NOT NULL,
    "txreceipt_status" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "cumulativeGasUsed" TEXT NOT NULL,
    "gasUsed" TEXT NOT NULL,
    "confirmations" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TokenTransfer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "blockNumber" TEXT NOT NULL,
    "timeStamp" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenDecimal" TEXT NOT NULL,
    "transactionIndex" TEXT NOT NULL,
    "gas" TEXT NOT NULL,
    "gasPrice" TEXT NOT NULL,
    "gasUsed" TEXT NOT NULL,
    "cumulativeGasUsed" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "confirmations" TEXT NOT NULL
);
