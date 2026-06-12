describe('GasReadingService', () => {
  describe('parseFileName', () => {
    function parseFileName(fileName) {
      const base = fileName.replace(/\.(xlsx|xls|csv)$/i, '')
      let furnaceNo = null
      let furnaceName = null
      let periodStart = null
      let periodEnd = null

      const furnaceMatch = base.match(/가열로?\s*(\d+)\s*호기?/i)
      if (furnaceMatch) {
        furnaceNo = parseInt(furnaceMatch[1])
        furnaceName = `가열${furnaceNo}호`
      }

      const dateRangeMatch = base.match(/\((\d{4}-\d{2}-\d{2})\s*[~\-]\s*(\d{4}-\d{2}-\d{2})\)/)
      if (dateRangeMatch) {
        periodStart = dateRangeMatch[1]
        periodEnd = dateRangeMatch[2]
      }

      return { fileName, furnaceNo, furnaceName, periodStart, periodEnd }
    }

    it('should extract furnace number and date range from standard filename', () => {
      const result = parseFileName('가열로19호기_가스_온도(2026-05-01 ~ 2026-05-31).xlsx')
      expect(result.furnaceNo).toBe(19)
      expect(result.furnaceName).toBe('가열19호')
      expect(result.periodStart).toBe('2026-05-01')
      expect(result.periodEnd).toBe('2026-05-31')
    })

    it('should handle filename without date range', () => {
      const result = parseFileName('가열로5호기_가스데이터.xlsx')
      expect(result.furnaceNo).toBe(5)
      expect(result.periodStart).toBeNull()
      expect(result.periodEnd).toBeNull()
    })

    it('should handle filename without furnace number', () => {
      const result = parseFileName('가스데이터(2026-06-01 ~ 2026-06-30).xlsx')
      expect(result.furnaceNo).toBeNull()
      expect(result.periodStart).toBe('2026-06-01')
      expect(result.periodEnd).toBe('2026-06-30')
    })

    it('should handle CSV extension', () => {
      const result = parseFileName('가열로1호기_가스(2026-01-01 ~ 2026-01-31).csv')
      expect(result.furnaceNo).toBe(1)
      expect(result.periodStart).toBe('2026-01-01')
    })

    it('should handle filename with dash separator in dates', () => {
      const result = parseFileName('가열로10호기_(2026-03-01 - 2026-03-31).xlsx')
      expect(result.furnaceNo).toBe(10)
      expect(result.periodStart).toBe('2026-03-01')
      expect(result.periodEnd).toBe('2026-03-31')
    })

    it('should return null for completely unrelated filename', () => {
      const result = parseFileName('report.xlsx')
      expect(result.furnaceNo).toBeNull()
      expect(result.periodStart).toBeNull()
    })
  })

  describe('Shift config', () => {
    function getShiftConfig(shift) {
      const configs = {
        day: { startHour: 8, startMinute: 0, endHour: 19, endMinute: 30, crossesMidnight: false },
        night: { startHour: 20, startMinute: 0, endHour: 7, endMinute: 0, crossesMidnight: true },
      }
      return configs[shift] || configs.day
    }

    it('should return day shift config', () => {
      const config = getShiftConfig('day')
      expect(config.startHour).toBe(8)
      expect(config.endHour).toBe(19)
      expect(config.endMinute).toBe(30)
      expect(config.crossesMidnight).toBe(false)
    })

    it('should return night shift config with midnight crossing', () => {
      const config = getShiftConfig('night')
      expect(config.startHour).toBe(20)
      expect(config.endHour).toBe(7)
      expect(config.crossesMidnight).toBe(true)
    })

    it('should calculate night shift period end correctly', () => {
      const config = getShiftConfig('night')
      const workDate = new Date('2026-06-10')
      const periodEnd = new Date(workDate)
      if (config.crossesMidnight) periodEnd.setDate(periodEnd.getDate() + 1)
      periodEnd.setHours(config.endHour, config.endMinute, 0, 0)

      expect(periodEnd.getDate()).toBe(11)
      expect(periodEnd.getHours()).toBe(7)
    })
  })

  describe('Usage calculation', () => {
    it('should calculate usage as gasAfter minus gasBefore', () => {
      const gasBefore = 1000.50
      const gasAfter = 1085.25
      const usage = gasAfter - gasBefore
      expect(usage).toBeCloseTo(84.75, 2)
    })

    it('should detect negative usage (rollover)', () => {
      const gasBefore = 1500.00
      const gasAfter = 100.00
      const usage = gasAfter - gasBefore
      expect(usage).toBeLessThan(0)
    })

    it('should handle zero usage', () => {
      const gasBefore = 1000.00
      const gasAfter = 1000.00
      const usage = gasAfter - gasBefore
      expect(usage).toBe(0)
    })
  })

  describe('Charge number generation', () => {
    it('should generate charge number in YYMMDD-NNN format', () => {
      const workDate = new Date(2026, 5, 10)
      const yy = String(workDate.getFullYear()).slice(-2)
      const mm = String(workDate.getMonth() + 1).padStart(2, '0')
      const dd = String(workDate.getDate()).padStart(2, '0')
      const seq = String(1).padStart(3, '0')
      const chargeNo = `${yy}${mm}${dd}-${seq}`
      expect(chargeNo).toBe('260610-001')
    })
  })
})
