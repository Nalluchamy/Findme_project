-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DELIVERY_AGENT', 'BRANCH_STAFF', 'HUB_OPERATOR', 'FINANCE_OFFICER', 'SELLER', 'ADMIN');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('BRANCH', 'HUB');

-- CreateEnum
CREATE TYPE "ParcelState" AS ENUM ('CREATED', 'COD_COLLECTED', 'HANDOVER_TO_DEST_HUB', 'HANDOVER_TO_ORIGIN_HUB', 'HANDOVER_TO_ORIGIN_BRANCH', 'SETTLED_TO_SELLER', 'DISCREPANCY_FLAGGED');

-- CreateEnum
CREATE TYPE "LedgerEventType" AS ENUM ('COD_COLLECTED', 'HANDOVER_TO_DEST_HUB', 'HANDOVER_TO_ORIGIN_HUB', 'HANDOVER_TO_ORIGIN_BRANCH', 'SETTLED_TO_SELLER', 'DISCREPANCY_FLAGGED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "codAmount" DECIMAL(10,2) NOT NULL,
    "originLocationId" TEXT NOT NULL,
    "destinationLocationId" TEXT NOT NULL,
    "currentState" "ParcelState" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEvent" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "eventType" "LedgerEventType" NOT NULL,
    "fromPartyId" TEXT,
    "toPartyId" TEXT,
    "expectedAmount" DECIMAL(10,2) NOT NULL,
    "confirmedAmount" DECIMAL(10,2),
    "confirmedByFrom" BOOLEAN NOT NULL DEFAULT false,
    "confirmedByTo" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "gpsCoords" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discrepancyNote" TEXT,

    CONSTRAINT "LedgerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_originLocationId_fkey" FOREIGN KEY ("originLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEvent" ADD CONSTRAINT "LedgerEvent_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEvent" ADD CONSTRAINT "LedgerEvent_fromPartyId_fkey" FOREIGN KEY ("fromPartyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEvent" ADD CONSTRAINT "LedgerEvent_toPartyId_fkey" FOREIGN KEY ("toPartyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
