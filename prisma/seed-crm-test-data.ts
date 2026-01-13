import prisma from '@/config/db';

async function seedCRMData() {
  console.log('🌱 Starting CRM seed data...');

  try {
    // Clean up existing test data first
    console.log('🧹 Cleaning up existing test data...');
    await prisma.leadActivity.deleteMany({
      where: {
        lead: {
          referenceNumber: {
            startsWith: 'WTI2601000',
          },
        },
      },
    });
    await prisma.leadCommunication.deleteMany({
      where: {
        lead: {
          referenceNumber: {
            startsWith: 'WTI2601000',
          },
        },
      },
    });
    await prisma.leadReminder.deleteMany({
      where: {
        lead: {
          referenceNumber: {
            startsWith: 'WTI2601000',
          },
        },
      },
    });
    await prisma.leadQuotation.deleteMany({
      where: {
        lead: {
          referenceNumber: {
            startsWith: 'WTI2601000',
          },
        },
      },
    });
    await prisma.leadNote.deleteMany({
      where: {
        lead: {
          referenceNumber: {
            startsWith: 'WTI2601000',
          },
        },
      },
    });
    await prisma.lead.deleteMany({
      where: {
        referenceNumber: {
          startsWith: 'WTI2601000',
        },
      },
    });
    console.log('✅ Cleanup completed');

    // Get the first admin user to assign leads
    const admin = await prisma.admin.findFirst({
      where: { isActive: true },
    });

    if (!admin) {
      console.error('❌ No active admin found. Please create an admin first.');
      return;
    }

    console.log(`✅ Found admin: ${admin.name} (${admin.email})`);

    // Create Lead Tags (use upsert to avoid duplicates)
    console.log('\n📌 Creating Lead Tags...');
    const tags = await Promise.all([
      prisma.leadTag.upsert({
        where: { name: 'VIP' },
        update: {},
        create: {
          name: 'VIP',
          label: 'VIP Customer',
          color: '#FFD700',
          icon: '👑',
          description: 'High-value VIP customers',
          order: 1,
          isActive: true,
        },
      }),
      prisma.leadTag.upsert({
        where: { name: 'URGENT' },
        update: {},
        create: {
          name: 'URGENT',
          label: 'Urgent',
          color: '#FF4444',
          icon: '🔥',
          description: 'Requires immediate attention',
          order: 2,
          isActive: true,
        },
      }),
      prisma.leadTag.upsert({
        where: { name: 'REPEAT' },
        update: {},
        create: {
          name: 'REPEAT',
          label: 'Repeat Customer',
          color: '#4CAF50',
          icon: '🔄',
          description: 'Returning customer',
          order: 3,
          isActive: true,
        },
      }),
    ]);
    console.log(`✅ Created/Updated ${tags.length} tags`);

    // Create Lead Categories (use upsert to avoid duplicates)
    console.log('\n📂 Creating Lead Categories...');
    const categories = await Promise.all([
      prisma.leadCategory.upsert({
        where: { name: 'HONEYMOON' },
        update: {},
        create: {
          name: 'HONEYMOON',
          label: 'Honeymoon Package',
          icon: '💑',
          description: 'Honeymoon and romantic getaways',
          order: 1,
          isActive: true,
        },
      }),
      prisma.leadCategory.upsert({
        where: { name: 'FAMILY' },
        update: {},
        create: {
          name: 'FAMILY',
          label: 'Family Tour',
          icon: '👨‍👩‍👧‍👦',
          description: 'Family vacation packages',
          order: 2,
          isActive: true,
        },
      }),
      prisma.leadCategory.upsert({
        where: { name: 'ADVENTURE' },
        update: {},
        create: {
          name: 'ADVENTURE',
          label: 'Adventure Tour',
          icon: '🏔️',
          description: 'Adventure and trekking tours',
          order: 3,
          isActive: true,
        },
      }),
    ]);
    console.log(`✅ Created/Updated ${categories.length} categories`);

    // Create Sample Leads
    console.log('\n👥 Creating Sample Leads...');

    // Lead 1: HOT - New Lead (Europe Family Tour)
    const lead1 = await prisma.lead.create({
      data: {
        referenceNumber: 'WTI260100001',
        fullName: 'Rajesh Sharma',
        email: 'rajesh.sharma@example.com',
        phoneNumber: '+91-9876543210',
        alternatePhone: '+91-9876543211',
        city: 'Mumbai',
        source: 'WEBSITE_FORM',
        status: 'NEW',
        priority: 'HOT',
        quality: 'A',
        serviceType: 'TOUR',
        destination: 'Europe (Switzerland, Italy)',
        travelStartDate: new Date('2026-03-15'),
        travelEndDate: new Date('2026-03-30'),
        numberOfTravelers: 4,
        numberOfAdults: 2,
        numberOfChildren: 2,
        budgetMin: 700000,
        budgetMax: 850000,
        specialRequests: 'Vegetarian meals, prefer luxury hotels',
        tagId: tags[0].id, // VIP
        categoryId: categories[1].id, // FAMILY
        assignedToId: admin.id,
        assignedAt: new Date(),
        leadScore: 85,
        conversionProbability: 75,
        estimatedValue: 800000,
        lastActivityAt: new Date(),
        followUpCount: 0,
        isOverdue: false,
      },
    });

    // Lead 2: WARM - Contacted (Bali Honeymoon)
    const lead2 = await prisma.lead.create({
      data: {
        referenceNumber: 'WTI260100002',
        fullName: 'Priya Patel',
        email: 'priya.patel@example.com',
        phoneNumber: '+91-9876543220',
        city: 'Ahmedabad',
        source: 'FACEBOOK',
        status: 'CONTACTED',
        priority: 'WARM',
        quality: 'B',
        serviceType: 'TOUR',
        destination: 'Bali, Indonesia',
        travelStartDate: new Date('2026-04-10'),
        travelEndDate: new Date('2026-04-17'),
        numberOfTravelers: 2,
        numberOfAdults: 2,
        numberOfChildren: 0,
        budgetMin: 150000,
        budgetMax: 200000,
        specialRequests: 'Beach resort, private pool villa',
        tagId: tags[2].id, // REPEAT
        categoryId: categories[0].id, // HONEYMOON
        assignedToId: admin.id,
        assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        leadScore: 65,
        conversionProbability: 55,
        estimatedValue: 175000,
        contactedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        firstResponseAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        responseTimeMinutes: 120,
        lastActivityAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        nextFollowUpAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
        followUpCount: 1,
        isOverdue: false,
      },
    });

    // Lead 3: HOT - Quoted (Dubai Tour)
    const lead3 = await prisma.lead.create({
      data: {
        referenceNumber: 'WTI260100003',
        fullName: 'Amit Kumar',
        email: 'amit.kumar@example.com',
        phoneNumber: '+91-9876543230',
        city: 'Delhi',
        source: 'GOOGLE_ADS',
        status: 'QUOTED',
        priority: 'HOT',
        quality: 'A',
        serviceType: 'TOUR',
        destination: 'Dubai, UAE',
        travelStartDate: new Date('2026-02-20'),
        travelEndDate: new Date('2026-02-27'),
        numberOfTravelers: 3,
        numberOfAdults: 2,
        numberOfChildren: 1,
        budgetMin: 250000,
        budgetMax: 300000,
        specialRequests: 'Desert safari, Burj Khalifa tickets',
        tagId: tags[1].id, // URGENT
        categoryId: categories[1].id, // FAMILY
        assignedToId: admin.id,
        assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        leadScore: 90,
        conversionProbability: 80,
        estimatedValue: 280000,
        contactedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        firstResponseAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        responseTimeMinutes: 45,
        lastActivityAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        nextFollowUpAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        followUpCount: 3,
        isOverdue: false,
      },
    });

    // Lead 4: COLD - Not Interested
    const lead4 = await prisma.lead.create({
      data: {
        referenceNumber: 'WTI260100004',
        fullName: 'Sneha Reddy',
        email: 'sneha.reddy@example.com',
        phoneNumber: '+91-9876543240',
        city: 'Bangalore',
        source: 'PHONE_CALL',
        status: 'NOT_INTERESTED',
        priority: 'COLD',
        quality: 'C',
        serviceType: 'TOUR',
        destination: 'Thailand',
        travelStartDate: new Date('2026-05-01'),
        travelEndDate: new Date('2026-05-07'),
        numberOfTravelers: 2,
        numberOfAdults: 2,
        numberOfChildren: 0,
        budgetMin: 80000,
        budgetMax: 100000,
        categoryId: categories[1].id,
        assignedToId: admin.id,
        assignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        leadScore: 25,
        conversionProbability: 10,
        estimatedValue: 90000,
        contactedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        firstResponseAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        responseTimeMinutes: 180,
        lastActivityAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        closedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        lostReason: 'Budget too high',
        followUpCount: 2,
        isOverdue: false,
      },
    });

    // Lead 5: WARM - Confirmed (Kerala Tour)
    const lead5 = await prisma.lead.create({
      data: {
        referenceNumber: 'WTI260100005',
        fullName: 'Vikram Singh',
        email: 'vikram.singh@example.com',
        phoneNumber: '+91-9876543250',
        city: 'Jaipur',
        source: 'REFERRAL',
        status: 'CONFIRMED',
        priority: 'WARM',
        quality: 'A',
        serviceType: 'TOUR',
        destination: 'Kerala, India',
        travelStartDate: new Date('2026-02-15'),
        travelEndDate: new Date('2026-02-22'),
        numberOfTravelers: 2,
        numberOfAdults: 2,
        numberOfChildren: 0,
        budgetMin: 120000,
        budgetMax: 150000,
        specialRequests: 'Houseboat stay, Ayurvedic spa',
        tagId: tags[0].id, // VIP
        categoryId: categories[0].id, // HONEYMOON
        assignedToId: admin.id,
        assignedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        leadScore: 95,
        conversionProbability: 95,
        estimatedValue: 135000,
        actualValue: 135000,
        contactedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        firstResponseAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        responseTimeMinutes: 30,
        lastActivityAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        followUpCount: 5,
        isOverdue: false,
      },
    });

    console.log(`✅ Created 5 sample leads`);

    // Create Notes for leads
    console.log('\n📝 Creating Notes...');
    await Promise.all([
      prisma.leadNote.create({
        data: {
          leadId: lead1.id,
          content:
            'Customer is very interested in Switzerland. Wants to visit Jungfraujoch and Interlaken.',
          createdById: admin.id,
        },
      }),
      prisma.leadNote.create({
        data: {
          leadId: lead2.id,
          content: 'Discussed Bali itinerary. Customer prefers Ubud and Seminyak areas.',
          createdById: admin.id,
        },
      }),
      prisma.leadNote.create({
        data: {
          leadId: lead3.id,
          content: 'Sent detailed Dubai package. Customer comparing with other agencies.',
          createdById: admin.id,
        },
      }),
    ]);
    console.log('✅ Created notes');

    // Create Communications
    console.log('\n📞 Creating Communications...');
    await Promise.all([
      prisma.leadCommunication.create({
        data: {
          leadId: lead1.id,
          type: 'CALL',
          direction: 'OUTBOUND',
          subject: 'Initial inquiry call',
          content: 'Discussed Europe tour requirements. Customer interested in 15-day package.',
          duration: 15,
          performedById: admin.id,
        },
      }),
      prisma.leadCommunication.create({
        data: {
          leadId: lead2.id,
          type: 'EMAIL',
          direction: 'OUTBOUND',
          subject: 'Bali honeymoon package details',
          content: 'Sent detailed itinerary with hotel options and pricing.',
          performedById: admin.id,
        },
      }),
      prisma.leadCommunication.create({
        data: {
          leadId: lead3.id,
          type: 'WHATSAPP',
          direction: 'INBOUND',
          subject: 'Query about Dubai visa',
          content: 'Customer asked about visa processing time and requirements.',
          performedById: admin.id,
        },
      }),
    ]);
    console.log('✅ Created communications');

    // Create Reminders
    console.log('\n⏰ Creating Reminders...');
    await Promise.all([
      // Today's reminder
      prisma.leadReminder.create({
        data: {
          leadId: lead1.id,
          scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          reminderType: 'FOLLOW_UP',
          notes: 'Follow up on Europe tour quotation',
          isCompleted: false,
          assignedToId: admin.id,
          createdById: admin.id,
        },
      }),
      // Tomorrow's reminder
      prisma.leadReminder.create({
        data: {
          leadId: lead2.id,
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          reminderType: 'CALLBACK',
          notes: 'Call back to discuss Bali package pricing',
          isCompleted: false,
          assignedToId: admin.id,
          createdById: admin.id,
        },
      }),
      // Overdue reminder
      prisma.leadReminder.create({
        data: {
          leadId: lead3.id,
          scheduledFor: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday (overdue)
          reminderType: 'QUOTE_FOLLOW_UP',
          notes: 'Follow up on Dubai quotation acceptance',
          isCompleted: false,
          assignedToId: admin.id,
          createdById: admin.id,
        },
      }),
      // Completed reminder
      prisma.leadReminder.create({
        data: {
          leadId: lead5.id,
          scheduledFor: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          reminderType: 'FOLLOW_UP',
          notes: 'Confirm Kerala booking',
          isCompleted: true,
          completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          assignedToId: admin.id,
          createdById: admin.id,
        },
      }),
    ]);
    console.log('✅ Created reminders');

    // Create Quotations
    console.log('\n💰 Creating Quotations...');
    await Promise.all([
      prisma.leadQuotation.create({
        data: {
          leadId: lead3.id,
          version: 1,
          fileName: 'dubai-tour-quotation-v1.pdf',
          fileKey: 'quotations/dubai-tour-v1.pdf',
          fileUrl: 'https://example.com/quotations/dubai-tour-v1.pdf',
          fileSize: 245678,
          fileType: 'application/pdf',
          description: 'Dubai 7-day tour package with desert safari',
          amount: 280000,
          isAccepted: false,
          uploadedById: admin.id,
        },
      }),
      prisma.leadQuotation.create({
        data: {
          leadId: lead5.id,
          version: 1,
          fileName: 'kerala-tour-quotation.pdf',
          fileKey: 'quotations/kerala-tour.pdf',
          fileUrl: 'https://example.com/quotations/kerala-tour.pdf',
          fileSize: 189234,
          fileType: 'application/pdf',
          description: 'Kerala 7-day honeymoon package',
          amount: 135000,
          isAccepted: true,
          acceptedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          uploadedById: admin.id,
        },
      }),
    ]);
    console.log('✅ Created quotations');

    // Create Activity Logs
    console.log('\n📊 Creating Activity Logs...');
    await Promise.all([
      prisma.leadActivity.create({
        data: {
          leadId: lead1.id,
          activityType: 'LEAD_CREATED',
          description: 'Lead created from website form',
          performedById: admin.id,
        },
      }),
      prisma.leadActivity.create({
        data: {
          leadId: lead1.id,
          activityType: 'LEAD_ASSIGNED',
          description: `Lead assigned to ${admin.name}`,
          performedById: admin.id,
        },
      }),
      prisma.leadActivity.create({
        data: {
          leadId: lead2.id,
          activityType: 'STATUS_CHANGED',
          description: 'Status changed from NEW to CONTACTED',
          metadata: { oldStatus: 'NEW', newStatus: 'CONTACTED' },
          performedById: admin.id,
        },
      }),
      prisma.leadActivity.create({
        data: {
          leadId: lead3.id,
          activityType: 'QUOTATION_UPLOADED',
          description: 'Quotation uploaded - Version 1',
          performedById: admin.id,
        },
      }),
      prisma.leadActivity.create({
        data: {
          leadId: lead5.id,
          activityType: 'QUOTATION_ACCEPTED',
          description: 'Customer accepted quotation',
          performedById: admin.id,
        },
      }),
    ]);
    console.log('✅ Created activity logs');

    console.log('\n✨ CRM seed data completed successfully!');
    console.log('\n📈 Summary:');
    console.log(`   - ${tags.length} Lead Tags`);
    console.log(`   - ${categories.length} Lead Categories`);
    console.log(`   - 5 Sample Leads (various statuses)`);
    console.log(`   - 3 Notes`);
    console.log(`   - 3 Communications`);
    console.log(`   - 4 Reminders (including overdue)`);
    console.log(`   - 2 Quotations`);
    console.log(`   - 5 Activity Logs`);
    console.log('\n🎯 You can now test:');
    console.log('   ✅ Lead listing and filtering');
    console.log('   ✅ Lead detail view');
    console.log('   ✅ Status updates');
    console.log('   ✅ Notes and communications');
    console.log('   ✅ Reminders and follow-ups');
    console.log('   ✅ Quotations');
    console.log('   ✅ Analytics and dashboards');
    console.log('   ✅ Activity timeline');
  } catch (error) {
    console.error('❌ Error seeding CRM data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedCRMData().catch((error) => {
  console.error(error);
  process.exit(1);
});
