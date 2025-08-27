const { getRow, getAll } = require('../config/database');

class WorkingHoursManager {
  constructor() {
    this.cache = null;
    this.lastCacheUpdate = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Get working hours from database (with caching)
  async getWorkingHours() {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.cache && this.lastCacheUpdate && (now - this.lastCacheUpdate) < this.cacheTimeout) {
      return this.cache;
    }

    try {
      const hours = await getAll(`
        SELECT * FROM working_hours 
        ORDER BY day_of_week ASC
      `);
      
      this.cache = hours;
      this.lastCacheUpdate = now;
      return hours;
    } catch (error) {
      console.error('Error fetching working hours:', error);
      throw error;
    }
  }

  // Check if a specific date/time is within working hours
  async isWithinWorkingHours(dateTime) {
    try {
      const workingHours = await this.getWorkingHours();
      const date = new Date(dateTime);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const timeString = date.toTimeString().slice(0, 5); // HH:MM format
      
      // Find the working hours for this day
      const dayHours = workingHours.find(h => h.day_of_week === dayOfWeek);
      
      if (!dayHours || !dayHours.is_open) {
        return {
          isOpen: false,
          reason: `We are closed on ${dayHours?.day_name || 'this day'}`,
          nextOpen: await this.getNextOpenTime(date)
        };
      }

      // Check if time is within open hours
      const isAfterOpen = timeString >= dayHours.open_time;
      const isBeforeClose = timeString <= dayHours.close_time;
      
      if (!isAfterOpen) {
        return {
          isOpen: false,
          reason: `We open at ${dayHours.open_time} on ${dayHours.day_name}`,
          nextOpen: dayHours.open_time
        };
      }
      
      if (!isBeforeClose) {
        return {
          isOpen: false,
          reason: `We close at ${dayHours.close_time} on ${dayHours.day_name}`,
          nextOpen: await this.getNextOpenTime(date)
        };
      }

      // Break time logic removed - no more break time validation

      return {
        isOpen: true,
        reason: 'We are open for business',
        currentHours: {
          open: dayHours.open_time,
          close: dayHours.close_time
        }
      };
    } catch (error) {
      console.error('Error checking working hours:', error);
      throw error;
    }
  }

  // Get next open time
  async getNextOpenTime(fromDate) {
    try {
      const workingHours = await this.getWorkingHours();
      const date = new Date(fromDate);
      let daysChecked = 0;
      
      while (daysChecked < 7) {
        const dayOfWeek = date.getDay();
        const dayHours = workingHours.find(h => h.day_of_week === dayOfWeek);
        
        if (dayHours && dayHours.is_open) {
          const nextDate = new Date(date);
          nextDate.setHours(parseInt(dayHours.open_time.split(':')[0]));
          nextDate.setMinutes(parseInt(dayHours.open_time.split(':')[1]));
          nextDate.setSeconds(0);
          nextDate.setMilliseconds(0);
          
          // If the time has passed today, move to next occurrence
          if (nextDate <= fromDate) {
            date.setDate(date.getDate() + 1);
            daysChecked++;
            continue;
          }
          
          return {
            date: nextDate,
            day: dayHours.day_name,
            time: dayHours.open_time
          };
        }
        
        date.setDate(date.getDate() + 1);
        daysChecked++;
      }
      
      return null; // No open days found
    } catch (error) {
      console.error('Error getting next open time:', error);
      return null;
    }
  }

  // Get available time slots for a specific date
  async getAvailableTimeSlots(date, slotDuration = 60) {
    try {
      const workingHours = await this.getWorkingHours();
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay();
      const dayHours = workingHours.find(h => h.day_of_week === dayOfWeek);
      
      if (!dayHours || !dayHours.is_open) {
        return [];
      }

      const slots = [];
      const openTime = new Date(targetDate);
      const [openHour, openMinute] = dayHours.open_time.split(':').map(Number);
      openTime.setHours(openHour, openMinute, 0, 0);
      
      const closeTime = new Date(targetDate);
      const [closeHour, closeMinute] = dayHours.close_time.split(':').map(Number);
      closeTime.setHours(closeHour, closeMinute, 0, 0);
      
      // Break time logic removed

      let currentTime = new Date(openTime);
      
      while (currentTime < closeTime) {
        const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
        
        // Skip if slot extends beyond closing time
        if (slotEnd > closeTime) {
          break;
        }
        
        // Break time overlap check removed
        
        slots.push({
          start: new Date(currentTime),
          end: slotEnd,
          timeString: currentTime.toTimeString().slice(0, 5)
        });
        
        currentTime = slotEnd;
      }
      
      return slots;
    } catch (error) {
      console.error('Error getting available time slots:', error);
      return [];
    }
  }

  // Update working hours for a specific day
  async updateWorkingHours(dayOfWeek, updates) {
    try {
      const { runQuery } = require('../config/database');
      
      const result = await runQuery(`
        UPDATE working_hours 
        SET is_open = ?, open_time = ?, close_time = ?, 
            notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE day_of_week = ?
      `, [
        updates.is_open, updates.open_time, updates.close_time,
        updates.notes, dayOfWeek
      ]);
      
      // Clear cache to force refresh
      this.cache = null;
      this.lastCacheUpdate = null;
      
      return result;
    } catch (error) {
      console.error('Error updating working hours:', error);
      throw error;
    }
  }

  // Get working hours summary for display
  async getWorkingHoursSummary() {
    try {
      const workingHours = await this.getWorkingHours();
      const now = new Date();
      const today = workingHours.find(h => h.day_of_week === now.getDay());
      
      return {
        today: today ? {
          day: today.day_name,
          isOpen: today.is_open,
          hours: today.is_open ? `${today.open_time} - ${today.close_time}` : 'Closed'
        } : null,
        weekly: workingHours.map(h => ({
          day: h.day_name,
          isOpen: h.is_open,
          hours: h.is_open ? `${h.open_time} - ${h.close_time}` : 'Closed'
        })),
        nextOpen: await this.getNextOpenTime(now)
      };
    } catch (error) {
      console.error('Error getting working hours summary:', error);
      throw error;
    }
  }
}

module.exports = new WorkingHoursManager();
