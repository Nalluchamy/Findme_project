-- CreateIndex
CREATE INDEX "LedgerEvent_parcelId_idx" ON "LedgerEvent"("parcelId");

-- CreateIndex
CREATE INDEX "LedgerEvent_timestamp_idx" ON "LedgerEvent"("timestamp");

-- CreateIndex
CREATE INDEX "LedgerEvent_toPartyId_idx" ON "LedgerEvent"("toPartyId");

-- CreateIndex
CREATE INDEX "LedgerEvent_fromPartyId_idx" ON "LedgerEvent"("fromPartyId");

-- CreateIndex
CREATE INDEX "Parcel_currentState_idx" ON "Parcel"("currentState");

-- CreateIndex
CREATE INDEX "Parcel_createdAt_idx" ON "Parcel"("createdAt");

-- CreateIndex
CREATE INDEX "Parcel_sellerId_idx" ON "Parcel"("sellerId");

-- CreateIndex
CREATE INDEX "User_locationId_idx" ON "User"("locationId");
