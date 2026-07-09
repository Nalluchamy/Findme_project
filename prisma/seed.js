const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Clearing database...');
  await prisma.receipt.deleteMany({});
  await prisma.ledgerEvent.deleteMany({});
  await prisma.parcel.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.company.deleteMany({});

  console.log('Seeding company...');
  const company = await prisma.company.create({
    data: {
      name: 'FindMe Express Demo',
      slug: 'findme-demo',
    },
  });

  console.log('Seeding locations...');
  const originBranch = await prisma.location.create({
    data: { name: 'Delhi Origin Branch (DEL_BRANCH_1)', type: 'BRANCH', companyId: company.id },
  });
  const originHub = await prisma.location.create({
    data: { name: 'Delhi Hub (DEL_HUB)', type: 'HUB', companyId: company.id },
  });
  const destHub = await prisma.location.create({
    data: { name: 'Mumbai Hub (MUM_HUB)', type: 'HUB', companyId: company.id },
  });
  const destBranch = await prisma.location.create({
    data: { name: 'Mumbai Destination Branch (MUM_BRANCH_1)', type: 'BRANCH', companyId: company.id },
  });

  console.log('Seeding users...');
  const passwordHash = hashPassword('password123');

  const seller = await prisma.user.create({
    data: { username: 'seller', passwordHash, name: 'ElectroWorld Seller', role: 'SELLER', companyId: company.id },
  });
  const agent = await prisma.user.create({
    data: {
      username: 'agent',
      passwordHash,
      name: 'Ramesh (Delivery Agent)',
      role: 'DELIVERY_AGENT',
      locationId: destBranch.id,
      companyId: company.id,
    },
  });
  const branchStaffMum = await prisma.user.create({
    data: {
      username: 'branch_mum',
      passwordHash,
      name: 'Priya (Mumbai Branch Staff)',
      role: 'BRANCH_STAFF',
      locationId: destBranch.id,
      companyId: company.id,
    },
  });
  const hubOperatorMum = await prisma.user.create({
    data: {
      username: 'hub_mum',
      passwordHash,
      name: 'Amit (Mumbai Hub Operator)',
      role: 'HUB_OPERATOR',
      locationId: destHub.id,
      companyId: company.id,
    },
  });
  const hubOperatorDel = await prisma.user.create({
    data: {
      username: 'hub_del',
      passwordHash,
      name: 'Sunita (Delhi Hub Operator)',
      role: 'HUB_OPERATOR',
      locationId: originHub.id,
      companyId: company.id,
    },
  });
  const branchStaffDel = await prisma.user.create({
    data: {
      username: 'branch_del',
      passwordHash,
      name: 'Karan (Delhi Branch Staff)',
      role: 'BRANCH_STAFF',
      locationId: originBranch.id,
      companyId: company.id,
    },
  });
  const finance = await prisma.user.create({
    data: { username: 'finance', passwordHash, name: 'Sanjay (Finance Officer)', role: 'FINANCE_OFFICER', companyId: company.id },
  });
  const admin = await prisma.user.create({
    data: { username: 'admin', passwordHash, name: 'Super Admin', role: 'ADMIN', companyId: company.id },
  });

  console.log('Seeding parcels...');
  
  // Parcel 1: Brand new - Created by Seller
  const parcel1 = await prisma.parcel.create({
    data: {
      id: 'PRCL-001',
      trackingNumber: 'PRCL-001',
      sellerId: seller.id,
      codAmount: 1500.00,
      originLocationId: originBranch.id,
      destinationLocationId: destBranch.id,
      currentState: 'CREATED',
      companyId: company.id,
      carrier: 'ST_COURIER',
    },
  });

  // Parcel 2: COD Collected by delivery agent, cash physical handover to dest branch pending
  const parcel2 = await prisma.parcel.create({
    data: {
      id: 'PRCL-002',
      trackingNumber: 'PRCL-002',
      sellerId: seller.id,
      codAmount: 2000.00,
      originLocationId: originBranch.id,
      destinationLocationId: destBranch.id,
      currentState: 'COD_COLLECTED',
      companyId: company.id,
      carrier: 'ST_COURIER',
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel2.id,
      eventType: 'COD_COLLECTED',
      fromPartyId: agent.id,
      expectedAmount: 2000.00,
      confirmedAmount: 2000.00,
      confirmedByFrom: true,
      confirmedByTo: true,
      gpsCoords: '19.0760,72.8777',
    },
  });

  // Parcel 3: Handover from Destination Branch to Mumbai Hub initiated, waiting for Hub confirmation
  const parcel3 = await prisma.parcel.create({
    data: {
      id: 'PRCL-003',
      trackingNumber: 'PRCL-003',
      sellerId: seller.id,
      codAmount: 850.00,
      originLocationId: originBranch.id,
      destinationLocationId: destBranch.id,
      currentState: 'COD_COLLECTED',
      companyId: company.id,
      carrier: 'ST_COURIER',
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel3.id,
      eventType: 'COD_COLLECTED',
      fromPartyId: agent.id,
      expectedAmount: 850.00,
      confirmedAmount: 850.00,
      confirmedByFrom: true,
      confirmedByTo: true,
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel3.id,
      eventType: 'HANDOVER_TO_DEST_HUB',
      fromPartyId: branchStaffMum.id,
      toPartyId: hubOperatorMum.id,
      expectedAmount: 850.00,
      confirmedByFrom: true,
      confirmedByTo: false,
    },
  });

  // Parcel 4: Discrepancy flagged because Branch Staff confirmed a different amount than initiated
  const parcel4 = await prisma.parcel.create({
    data: {
      id: 'PRCL-004',
      trackingNumber: 'PRCL-004',
      sellerId: seller.id,
      codAmount: 1200.00,
      originLocationId: originBranch.id,
      destinationLocationId: destBranch.id,
      currentState: 'DISCREPANCY_FLAGGED',
      companyId: company.id,
      carrier: 'ST_COURIER',
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel4.id,
      eventType: 'COD_COLLECTED',
      fromPartyId: agent.id,
      expectedAmount: 1200.00,
      confirmedAmount: 1200.00,
      confirmedByFrom: true,
      confirmedByTo: true,
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel4.id,
      eventType: 'HANDOVER_TO_DEST_HUB',
      fromPartyId: branchStaffMum.id,
      toPartyId: hubOperatorMum.id,
      expectedAmount: 1200.00,
      confirmedAmount: 1000.00,
      confirmedByFrom: true,
      confirmedByTo: true,
      discrepancyNote: 'Mismatch: Handover amount was 1200, but recipient received 1000.',
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel4.id,
      eventType: 'DISCREPANCY_FLAGGED',
      expectedAmount: 1200.00,
      confirmedAmount: 1000.00,
      discrepancyNote: 'Mismatch: Handover amount was 1200, but recipient received 1000.',
    },
  });

  // Parcel 5: Settled to seller
  const parcel5 = await prisma.parcel.create({
    data: {
      id: 'PRCL-005',
      trackingNumber: 'PRCL-005',
      sellerId: seller.id,
      codAmount: 3500.00,
      originLocationId: originBranch.id,
      destinationLocationId: destBranch.id,
      currentState: 'SETTLED_TO_SELLER',
      companyId: company.id,
      carrier: 'ST_COURIER',
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel5.id,
      eventType: 'COD_COLLECTED',
      fromPartyId: agent.id,
      expectedAmount: 3500.00,
      confirmedAmount: 3500.00,
      confirmedByFrom: true,
      confirmedByTo: true,
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel5.id,
      eventType: 'HANDOVER_TO_DEST_HUB',
      fromPartyId: branchStaffMum.id,
      toPartyId: hubOperatorMum.id,
      expectedAmount: 3500.00,
      confirmedAmount: 3500.00,
      confirmedByFrom: true,
      confirmedByTo: true,
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel5.id,
      eventType: 'HANDOVER_TO_ORIGIN_HUB',
      fromPartyId: hubOperatorMum.id,
      toPartyId: hubOperatorDel.id,
      expectedAmount: 3500.00,
      confirmedAmount: 3500.00,
      confirmedByFrom: true,
      confirmedByTo: true,
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel5.id,
      eventType: 'HANDOVER_TO_ORIGIN_BRANCH',
      fromPartyId: hubOperatorDel.id,
      toPartyId: branchStaffDel.id,
      expectedAmount: 3500.00,
      confirmedAmount: 3500.00,
      confirmedByFrom: true,
      confirmedByTo: true,
    },
  });
  await prisma.ledgerEvent.create({
    data: {
      parcelId: parcel5.id,
      eventType: 'SETTLED_TO_SELLER',
      fromPartyId: branchStaffDel.id,
      toPartyId: seller.id,
      expectedAmount: 3500.00,
      confirmedAmount: 3500.00,
      confirmedByFrom: true,
      confirmedByTo: true,
      discrepancyNote: 'Payout Txn ID: TXN99882233',
    },
  });

  console.log('Database seeded successfully!');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
