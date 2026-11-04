const { Order } = require('../models');
const ApiResponse = require('../utils/apiResponse');

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Generate a chronological template array of the last N months (default: 6)
 * Initialized with 0 sales and 0 orders so charts always render all months.
 *
 * @param {number} monthsCount
 * @returns {Array<Object>}
 */
const generateSixMonthsTemplate = (monthsCount = 6) => {
  const months = [];
  const now = new Date();

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    const monthName = MONTH_NAMES[month - 1];
    const label = `${monthName} ${year}`;

    months.push({
      year,
      month,
      monthName,
      label,
      totalSales: 0,
      totalOrders: 0,
      averageOrderValue: 0,
    });
  }

  return months;
};

/**
 * Get 6 Months Sales Analytics
 * Single source of truth: Actual MongoDB Order collection records.
 * Rules:
 * - Excludes cancelled and returned orders.
 * - Excludes unpaid orders (only paymentStatus: 'paid' is recognized as revenue).
 * - Zero fake data, zero manual entries.
 * - Includes all 6 months chronologically with zero-filled defaults.
 *
 * @route   GET /api/admin/sales
 * @access  Protected (Admin only)
 */
const getSalesAnalytics = async (req, res, next) => {
  try {
    const monthsCount = Math.min(
      12,
      Math.max(1, parseInt(req.query.months, 10) || 6)
    );

    // Calculate start date (1st of month (monthsCount - 1) months ago at 00:00:00)
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - (monthsCount - 1),
      1,
      0,
      0,
      0,
      0
    );

    // 1. Generate full chronological template (zero-filled)
    const monthlySalesTemplate = generateSixMonthsTemplate(monthsCount);

    // 2. MongoDB Aggregation Pipeline for Monthly Sales
    const pipeline = [
      {
        $match: {
          paymentStatus: 'paid', // Exclude unpaid orders from completed revenue
          orderStatus: { $nin: ['cancelled', 'returned'] }, // Exclude cancelled/returned orders
          orderDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$orderDate' },
            month: { $month: '$orderDate' },
          },
          totalRevenue: { $sum: '$finalTotal' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$finalTotal' },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
        },
      },
    ];

    // 3. Payment Method Breakdown for completed sales
    const paymentPipeline = [
      {
        $match: {
          paymentStatus: 'paid',
          orderStatus: { $nin: ['cancelled', 'returned'] },
          orderDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$finalTotal' },
          orderCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
    ];

    const [monthlyResults, paymentResults] = await Promise.all([
      Order.aggregate(pipeline),
      Order.aggregate(paymentPipeline),
    ]);

    // 4. Merge DB Aggregation into Chronological Template
    monthlyResults.forEach((record) => {
      const match = monthlySalesTemplate.find(
        (m) => m.year === record._id.year && m.month === record._id.month
      );

      if (match) {
        match.totalSales = Math.round(record.totalRevenue * 100) / 100;
        match.totalOrders = record.totalOrders;
        match.averageOrderValue = Math.round(record.averageOrderValue * 100) / 100;
      }
    });

    // 5. Calculate Overall Summaries for the Period
    const overallTotalSales = Math.round(
      monthlySalesTemplate.reduce((acc, m) => acc + m.totalSales, 0) * 100
    ) / 100;

    const overallTotalOrders = monthlySalesTemplate.reduce(
      (acc, m) => acc + m.totalOrders,
      0
    );

    const overallAverageOrderValue =
      overallTotalOrders > 0
        ? Math.round((overallTotalSales / overallTotalOrders) * 100) / 100
        : 0;

    const firstMonth = monthlySalesTemplate[0].label;
    const lastMonth = monthlySalesTemplate[monthlySalesTemplate.length - 1].label;
    const periodLabel = `${firstMonth} - ${lastMonth}`;

    const paymentMethodBreakdown = paymentResults.map((p) => ({
      paymentMethod: p._id || 'unknown',
      totalAmount: Math.round(p.totalAmount * 100) / 100,
      orderCount: p.orderCount,
    }));

    const responseData = {
      period: periodLabel,
      monthsCount,
      overallSummary: {
        totalSales: overallTotalSales,
        totalEligibleOrders: overallTotalOrders,
        averageOrderValue: overallAverageOrderValue,
      },
      monthlySales: monthlySalesTemplate,
      paymentMethodBreakdown,
    };

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          responseData,
          'Sales analytics data retrieved successfully.'
        )
      );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSalesAnalytics,
  generateSixMonthsTemplate,
};

