/*
  Warnings:

  - The primary key for the `TokenTransfer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `TokenTransfer` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TokenTransfer" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "blockNumber" TEXT NOT NULL,
    "timeStamp" TEXT NOT NULL,
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
INSERT INTO "new_TokenTransfer" ("blockHash", "blockNumber", "confirmations", "contractAddress", "cumulativeGasUsed", "from", "gas", "gasPrice", "gasUsed", "hash", "input", "nonce", "timeStamp", "to", "tokenDecimal", "tokenName", "tokenSymbol", "transactionIndex", "value") SELECT "blockHash", "blockNumber", "confirmations", "contractAddress", "cumulativeGasUsed", "from", "gas", "gasPrice", "gasUsed", "hash", "input", "nonce", "timeStamp", "to", "tokenDecimal", "tokenName", "tokenSymbol", "transactionIndex", "value" FROM "TokenTransfer";
DROP TABLE "TokenTransfer";
ALTER TABLE "new_TokenTransfer" RENAME TO "TokenTransfer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
