import NewsletterSignup from '../models/NewsletterSignup.js';
import AppError from '../utils/AppError.js';

/**
 * Newsletter Service
 * Handles business logic for newsletter operations
 */
class NewsletterService {
  /**
   * Create a new newsletter signup
   * @param {Object} signupData - The signup data
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} The created signup
   */
  async createSignup(signupData, metadata = {}) {
    try {
      const signup = new NewsletterSignup({
        ...signupData,
        metadata,
      });

      await signup.save();
      return signup;
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError('Email already subscribed to this workspace newsletter', 400);
      }
      throw error;
    }
  }

  /**
   * Get signups for a workspace with pagination and filtering
   * @param {string} workspaceId - The workspace ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Signups and pagination info
   */
  async getSignups(workspaceId, options = {}) {
    const { page = 1, limit = 20, status, source, search } = options;

    const query = { workspaceId };

    if (status) query.status = status;
    if (source) query.source = source;
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { workspaceName: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [signups, total] = await Promise.all([
      NewsletterSignup.find(query)
        .sort({ subscribedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      NewsletterSignup.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      signups,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get newsletter statistics for a workspace
   * @param {string} workspaceId - The workspace ID
   * @returns {Promise<Object>} Statistics data
   */
  async getStats(workspaceId) {
    const [basicStats, sourceStats, monthlyStats, recentSignups] = await Promise.all([
      NewsletterSignup.getWorkspaceStats(workspaceId),
      this.getSourceStats(workspaceId),
      this.getMonthlyStats(workspaceId),
      this.getRecentSignups(workspaceId),
    ]);

    return {
      overview: {
        ...basicStats,
        recentSignups,
      },
      sourceBreakdown: sourceStats,
      monthlyBreakdown: monthlyStats,
    };
  }

  /**
   * Unsubscribe a user from newsletter
   * @param {string} email - The email address
   * @param {string} workspaceId - The workspace ID
   * @returns {Promise<Object>} The updated signup
   */
  async unsubscribe(email, workspaceId) {
    const signup = await NewsletterSignup.findOne({
      email: email.toLowerCase(),
      workspaceId,
    });

    if (!signup) {
      throw new AppError('Subscription not found', 404);
    }

    if (signup.status === 'unsubscribed') {
      return signup;
    }

    await signup.unsubscribe();
    return signup;
  }

  /**
   * Delete a newsletter signup
   * @param {string} signupId - The signup ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteSignup(signupId) {
    const result = await NewsletterSignup.findByIdAndDelete(signupId);
    if (!result) {
      throw new AppError('Newsletter signup not found', 404);
    }
    return true;
  }

  /**
   * Get source statistics for a workspace
   * @param {string} workspaceId - The workspace ID
   * @returns {Promise<Object>} Source breakdown
   */
  async getSourceStats(workspaceId) {
    const stats = await NewsletterSignup.aggregate([
      { $match: { workspaceId } },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
        },
      },
    ]);

    const breakdown = {};
    stats.forEach((stat) => {
      breakdown[stat._id] = stat.count;
    });

    return breakdown;
  }

  /**
   * Get monthly statistics for a workspace
   * @param {string} workspaceId - The workspace ID
   * @returns {Promise<Array>} Monthly breakdown
   */
  async getMonthlyStats(workspaceId) {
    const stats = await NewsletterSignup.aggregate([
      { $match: { workspaceId } },
      {
        $group: {
          _id: {
            year: { $year: '$subscribedAt' },
            month: { $month: '$subscribedAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);

    return stats.map((stat) => ({
      month: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}`,
      count: stat.count,
    }));
  }

  /**
   * Get recent signups count (last 7 days)
   * @param {string} workspaceId - The workspace ID
   * @returns {Promise<number>} Recent signups count
   */
  async getRecentSignups(workspaceId) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return NewsletterSignup.countDocuments({
      workspaceId,
      subscribedAt: { $gte: sevenDaysAgo },
    });
  }

  /**
   * Export newsletter signups for a workspace
   * @param {string} workspaceId - The workspace ID
   * @returns {Promise<Array>} Signups data for export
   */
  async exportSignups(workspaceId) {
    const signups = await NewsletterSignup.find({ workspaceId })
      .sort({ subscribedAt: -1 })
      .select('-__v -metadata');

    return signups.map((signup) => ({
      email: signup.email,
      workspaceName: signup.workspaceName,
      source: signup.source,
      status: signup.status,
      subscribedAt: signup.subscribedAt,
      unsubscribedAt: signup.unsubscribedAt,
    }));
  }
}

export default new NewsletterService();
