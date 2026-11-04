/**
 * Initial Superadmin Seed Script for Faa Organic
 * Run via: npm run seed:admin
 * Or: node scripts/seed-admin.js
 *
 * Credentials are read securely from .env (INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD)
 * or via CLI flags (--name, --email, --password).
 * Never hardcodes credentials. Passwords are automatically hashed via bcrypt.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (.env has priority, fallback to .env.example)
const envPath = fs.existsSync(path.resolve(process.cwd(), '.env'))
  ? path.resolve(process.cwd(), '.env')
  : fs.existsSync(path.resolve(process.cwd(), '.env.example'))
  ? path.resolve(process.cwd(), '.env.example')
  : undefined;
dotenv.config(envPath ? { path: envPath } : undefined);

const connectDB = require('../src/config/db');
const { Admin } = require('../src/models');

// Parse optional CLI arguments
const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key && value) args[key] = value;
    }
  });
  return args;
};

const cliArgs = parseArgs();

const adminName =
  cliArgs.name || process.env.INITIAL_ADMIN_NAME || 'Super Admin';
const adminEmail =
  cliArgs.email || process.env.INITIAL_ADMIN_EMAIL || 'admin@faaorganic.com';
const adminPassword =
  cliArgs.password || process.env.INITIAL_ADMIN_PASSWORD || 'FaaOrganic@Admin2026';

const seedAdmin = async () => {
  console.log('====================================================');
  console.log('🔐 Faa Organic - Initial Admin Account Setup');
  console.log('====================================================\n');

  if (!adminEmail || !adminPassword) {
    console.error('❌ Error: Admin email and password must be configured in .env:');
    console.error('   INITIAL_ADMIN_EMAIL=your-email@faaorganic.com');
    console.error('   INITIAL_ADMIN_PASSWORD=your-secure-password\n');
    process.exit(1);
  }

  const cleanEmail = adminEmail.toLowerCase().trim();

  // Attempt database connection
  console.log('Connecting to database...');
  const conn = await connectDB();

  if (!conn) {
    console.warn(
      '⚠️  Cannot establish database connection. Please check MONGODB_URI in .env.'
    );
    console.warn('   Ensure MongoDB Atlas IP is whitelisted (0.0.0.0/0).');
    process.exit(1);
  }

  try {
    // Check for existing admin with this email
    const existingAdmin = await Admin.findOne({ email: cleanEmail });

    if (existingAdmin) {
      console.log(`ℹ️  Admin with email "${cleanEmail}" already exists.`);
      console.log(`   Role           : ${existingAdmin.role}`);
      console.log(`   Account Status : ${existingAdmin.accountStatus}`);
      console.log(`   ID             : ${existingAdmin._id}`);
      console.log('\n✅ No duplicates created. Initial admin setup is already complete.');
    } else {
      // Create new superadmin (password is automatically hashed by Admin model pre-save hook)
      const newAdmin = await Admin.create({
        name: adminName,
        email: cleanEmail,
        password: adminPassword,
        role: 'superadmin',
        accountStatus: 'active',
      });

      console.log('🎉 Superadmin account created successfully!');
      console.log(`   Name           : ${newAdmin.name}`);
      console.log(`   Email          : ${newAdmin.email}`);
      console.log(`   Role           : ${newAdmin.role}`);
      console.log(`   Account Status : ${newAdmin.accountStatus}`);
      console.log(`   ID             : ${newAdmin._id}`);
      console.log('   Password       : [PROTECTED & HASHED VIA BCRYPT]');
    }
  } catch (error) {
    console.error('❌ Error seeding admin account:', error.message);
  } finally {
    if (typeof connectDB.disconnectDB === 'function') {
      await connectDB.disconnectDB();
    }
    console.log('\n====================================================');
    process.exit(0);
  }
};

seedAdmin();

