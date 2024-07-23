/*
  Warnings:

  - The primary key for the `Address` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `addressId` on the `Label` table. All the data in the column will be lost.
  - Added the required column `addressAddress` to the `Label` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Label" DROP CONSTRAINT "Label_addressId_fkey";

-- DropIndex
DROP INDEX "Address_address_key";

-- AlterTable
ALTER TABLE "Address" DROP CONSTRAINT "Address_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Address_pkey" PRIMARY KEY ("address");

-- AlterTable
ALTER TABLE "Label" DROP COLUMN "addressId",
ADD COLUMN     "addressAddress" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_addressAddress_fkey" FOREIGN KEY ("addressAddress") REFERENCES "Address"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
