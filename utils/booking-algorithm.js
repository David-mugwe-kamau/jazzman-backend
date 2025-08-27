const { getRow, getAll } = require('../config/database');

/**
 * Smart Booking Algorithm for Fair Distribution
 * This algorithm ensures all barbers get even bookings by considering:
 * 1. Current workload (pending + in-progress bookings)
 * 2. Total services completed
 * 3. Performance rating
 * 4. Availability status
 */

class SmartBookingAlgorithm {
  
  /**
   * Get the best available barber for a new booking
   * @param {string} preferredDateTime - Preferred appointment time
   * @param {string} serviceType - Type of service requested
   * @returns {Object} Selected barber with assignment reason
   */
  static async getBestBarber(preferredDateTime, serviceType) {
    try {
      // Get all active and unblocked barbers
      const activeBarbers = await getAll(`
        SELECT 
          id, name, phone, email, identity_badge_number,
          total_services, total_earnings, is_active,
          current_location
        FROM barbers 
        WHERE is_active = 1 AND is_blocked = 0
        ORDER BY total_services ASC, total_earnings ASC
      `);

      if (activeBarbers.length === 0) {
        throw new Error('No active barbers available');
      }

      // Calculate workload for each barber
      const barbersWithWorkload = await Promise.all(
        activeBarbers.map(async (barber) => {
          const workload = await this.calculateBarberWorkload(barber.id, preferredDateTime);
          const score = this.calculateBarberScore(barber, workload);
          
          return {
            ...barber,
            workload,
            score
          };
        })
      );

      // Sort by score (lower score = better choice)
      barbersWithWorkload.sort((a, b) => a.score - b.score);

      // Select the barber with the best score
      const selectedBarber = barbersWithWorkload[0];
      
      return {
        barber: selectedBarber,
        reason: this.getAssignmentReason(selectedBarber, barbersWithWorkload),
        alternatives: barbersWithWorkload.slice(1, 3) // Top 3 alternatives
      };

    } catch (error) {
      console.error('Error in smart booking algorithm:', error);
      throw error;
    }
  }

  /**
   * Calculate current workload for a barber
   * @param {number} barberId - Barber ID
   * @param {string} preferredDateTime - Preferred appointment time
   * @returns {Object} Workload information
   */
  static async calculateBarberWorkload(barberId, preferredDateTime) {
    try {
      // Get pending and in-progress bookings for the barber
      const activeBookings = await getAll(`
        SELECT COUNT(*) as count, SUM(service_price) as total_value
        FROM bookings 
        WHERE barber_id = ? 
        AND status IN ('pending', 'in_progress')
        AND DATE(preferred_datetime) = DATE(?)
      `, [barberId, preferredDateTime]);

      // Get total pending bookings (all time)
      const totalPending = await getRow(`
        SELECT COUNT(*) as count
        FROM bookings 
        WHERE barber_id = ? 
        AND status IN ('pending', 'in_progress')
      `, [barberId]);

      return {
        dailyBookings: activeBookings[0]?.count || 0,
        dailyValue: activeBookings[0]?.total_value || 0,
        totalPending: totalPending?.count || 0
      };
    } catch (error) {
      console.error('Error calculating barber workload:', error);
      return { dailyBookings: 0, dailyValue: 0, totalPending: 0 };
    }
  }

  /**
   * Calculate a score for barber selection (lower is better)
   * @param {Object} barber - Barber information
   * @param {Object} workload - Current workload
   * @returns {number} Score (lower = better choice)
   */
  static calculateBarberScore(barber, workload) {
    let score = 0;

    // Factor 1: Daily workload (40% weight)
    const dailyWorkloadScore = workload.dailyBookings * 10;
    score += dailyWorkloadScore * 0.4;

    // Factor 2: Total services completed (30% weight)
    // Barbers with fewer services get priority
    const serviceScore = (100 - Math.min(barber.total_services, 100)) / 100;
    score += (1 - serviceScore) * 0.3;

    // Factor 3: Total earnings (20% weight)
    // Barbers with lower earnings get priority
    const earningsScore = (10000 - Math.min(barber.total_earnings, 10000)) / 10000;
    score += (1 - earningsScore) * 0.2;

    // Factor 4: Total pending bookings (10% weight)
    const pendingScore = workload.totalPending * 2;
    score += pendingScore * 0.1;

    return Math.round(score * 100) / 100;
  }

  /**
   * Get human-readable reason for barber assignment
   * @param {Object} selectedBarber - Selected barber
   * @param {Array} allBarbers - All barbers with scores
   * @returns {string} Assignment reason
   */
  static getAssignmentReason(selectedBarber, allBarbers) {
    const workload = selectedBarber.workload;
    
    if (workload.dailyBookings === 0) {
      return `${selectedBarber.name} has no bookings today and is available`;
    } else if (workload.dailyBookings <= 2) {
      return `${selectedBarber.name} has light workload today (${workload.dailyBookings} bookings)`;
    } else if (selectedBarber.total_services < 50) {
      return `${selectedBarber.name} is newer and has fewer total services (${selectedBarber.total_services})`;
    } else {
      return `${selectedBarber.name} has the best availability score among all barbers`;
    }
  }

  /**
   * Check if a barber is available at a specific time
   * @param {number} barberId - Barber ID
   * @param {string} preferredDateTime - Preferred appointment time
   * @param {number} serviceDuration - Service duration in minutes
   * @returns {boolean} Availability status
   */
  static async checkBarberAvailability(barberId, preferredDateTime, serviceDuration = 60) {
    try {
      const appointmentTime = new Date(preferredDateTime);
      const endTime = new Date(appointmentTime.getTime() + serviceDuration * 60000);

      // Check for time conflicts
      const conflicts = await getAll(`
        SELECT id, preferred_datetime, service_type
        FROM bookings 
        WHERE barber_id = ? 
        AND status IN ('pending', 'in_progress')
        AND DATE(preferred_datetime) = DATE(?)
        AND (
          (preferred_datetime BETWEEN ? AND ?) OR
          (datetime(preferred_datetime, '+60 minutes') BETWEEN ? AND ?) OR
          (? BETWEEN preferred_datetime AND datetime(preferred_datetime, '+60 minutes'))
        )
      `, [barberId, preferredDateTime, preferredDateTime, endTime.toISOString(), 
          preferredDateTime, endTime.toISOString(), preferredDateTime]);

      return conflicts.length === 0;
    } catch (error) {
      console.error('Error checking barber availability:', error);
      return false;
    }
  }

  /**
   * Get alternative barbers if primary choice is unavailable
   * @param {Array} barbers - List of barbers
   * @param {string} preferredDateTime - Preferred appointment time
   * @param {number} maxAlternatives - Maximum number of alternatives
   * @returns {Array} Available alternative barbers
   */
  static async getAlternativeBarbers(barbers, preferredDateTime, maxAlternatives = 3) {
    const alternatives = [];
    
    for (const barber of barbers) {
      if (alternatives.length >= maxAlternatives) break;
      
      const isAvailable = await this.checkBarberAvailability(barber.id, preferredDateTime);
      if (isAvailable) {
        alternatives.push(barber);
      }
    }
    
    return alternatives;
  }

  /**
   * Update barber statistics after booking completion
   * @param {number} barberId - Barber ID
   * @param {number} servicePrice - Service price
   */
  static async updateBarberStats(barberId, servicePrice) {
    try {
      await require('../config/database').runQuery(`
        UPDATE barbers SET 
          total_services = total_services + 1,
          total_earnings = total_earnings + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [servicePrice, barberId]);
    } catch (error) {
      console.error('Error updating barber stats:', error);
    }
  }
}

module.exports = SmartBookingAlgorithm;
