const fs = require('fs');

// 🔍 VALIDADOR Y LIMPIADOR DE DATOS COVID-19
class DataValidator {
  constructor() {
    // Rango válido de fechas para COVID-19
    this.COVID_START_DATE = new Date('2019-12-01'); // Primeros casos reportados
    this.COVID_END_DATE = new Date(); // Fecha actual
    
    // Países válidos (normalizados)
    this.VALID_COUNTRIES = {
      'colombia': 'Colombia',
      'argentina': 'Argentina', 
      'alemania': 'Alemania',
      'filipinas': 'Filipinas',
      'españa': 'España',
      'brasil': 'Brasil',
      'mexico': 'México',
      'peru': 'Perú',
      'chile': 'Chile',
      'ecuador': 'Ecuador'
    };
    
    // Tipos válidos de casos
    this.VALID_TYPES = ['confirmed', 'death', 'recovered'];
    
    this.errors = [];
    this.warnings = [];
  }
  
  // Normalizar nombre de país
  normalizeCountry(country) {
    if (!country) return null;
    
    const normalized = country.toLowerCase().trim();
    return this.VALID_COUNTRIES[normalized] || country.trim();
  }
  
  // Validar fecha
  validateDate(dateStr, lineNum) {
    try {
      const date = new Date(dateStr);
      
      // Verificar formato válido
      if (isNaN(date.getTime())) {
        this.errors.push(`Línea ${lineNum}: Fecha inválida '${dateStr}'`);
        return false;
      }
      
      // Verificar rango COVID-19
      if (date < this.COVID_START_DATE) {
        this.warnings.push(`Línea ${lineNum}: Fecha muy antigua '${dateStr}' (anterior a COVID-19)`);
      }
      
      if (date > this.COVID_END_DATE) {
        this.warnings.push(`Línea ${lineNum}: Fecha futura '${dateStr}'`);
      }
      
      return true;
    } catch (error) {
      this.errors.push(`Línea ${lineNum}: Error procesando fecha '${dateStr}': ${error.message}`);
      return false;
    }
  }
  
  // Validar tipo de caso
  validateType(type, lineNum) {
    if (!type || !this.VALID_TYPES.includes(type.toLowerCase())) {
      this.errors.push(`Línea ${lineNum}: Tipo inválido '${type}'. Debe ser: ${this.VALID_TYPES.join(', ')}`);
      return false;
    }
    return true;
  }
  
  // Validar número de casos
  validateCases(cases, lineNum) {
    const num = parseInt(cases);
    
    if (isNaN(num)) {
      this.errors.push(`Línea ${lineNum}: Número de casos inválido '${cases}'`);
      return false;
    }
    
    if (num < 0) {
      this.errors.push(`Línea ${lineNum}: Número de casos negativo '${cases}'`);
      return false;
    }
    
    if (num > 10000000) { // 10M casos máximo por registro
      this.warnings.push(`Línea ${lineNum}: Número de casos muy alto '${cases}'`);
    }
    
    return true;
  }
  
  // Validar y limpiar un registro completo
  validateRecord(record, lineNum) {
    const cleanRecord = { ...record };
    let isValid = true;
    
    // Validar país
    cleanRecord.country = this.normalizeCountry(record.country);
    if (!cleanRecord.country) {
      this.errors.push(`Línea ${lineNum}: País vacío o inválido`);
      isValid = false;
    }
    
    // Validar fecha
    if (!this.validateDate(record.date, lineNum)) {
      isValid = false;
    }
    
    // Validar tipo
    cleanRecord.type = record.type?.toLowerCase();
    if (!this.validateType(cleanRecord.type, lineNum)) {
      isValid = false;
    }
    
    // Validar casos
    if (!this.validateCases(record.cases, lineNum)) {
      isValid = false;
    } else {
      cleanRecord.cases = parseInt(record.cases);
    }
    
    return { record: cleanRecord, isValid };
  }
  
  // Procesar archivo completo
  processData(records) {
    this.errors = [];
    this.warnings = [];
    
    const cleanRecords = [];
    const invalidRecords = [];
    
    records.forEach((record, index) => {
      const lineNum = index + 2; // +2 porque empieza en línea 2 (después del header)
      const { record: cleanRecord, isValid } = this.validateRecord(record, lineNum);
      
      if (isValid) {
        cleanRecords.push(cleanRecord);
      } else {
        invalidRecords.push({ lineNum, record: record, errors: [...this.errors] });
      }
    });
    
    return {
      cleanRecords,
      invalidRecords,
      errors: this.errors,
      warnings: this.warnings,
      stats: {
        totalInput: records.length,
        validRecords: cleanRecords.length,
        invalidRecords: invalidRecords.length,
        errorRate: ((invalidRecords.length / records.length) * 100).toFixed(2) + '%'
      }
    };
  }
  
  // Generar reporte de validación
  generateReport(validationResult) {
    let report = "=== REPORTE DE VALIDACIÓN DE DATOS COVID-19 ===\n\n";
    
    report += `📊 ESTADÍSTICAS:\n`;
    report += `- Total registros procesados: ${validationResult.stats.totalInput}\n`;
    report += `- Registros válidos: ${validationResult.stats.validRecords}\n`;
    report += `- Registros inválidos: ${validationResult.stats.invalidRecords}\n`;
    report += `- Tasa de error: ${validationResult.stats.errorRate}\n\n`;
    
    if (validationResult.errors.length > 0) {
      report += `❌ ERRORES (${validationResult.errors.length}):\n`;
      validationResult.errors.forEach(error => report += `- ${error}\n`);
      report += "\n";
    }
    
    if (validationResult.warnings.length > 0) {
      report += `⚠️  ADVERTENCIAS (${validationResult.warnings.length}):\n`;
      validationResult.warnings.forEach(warning => report += `- ${warning}\n`);
      report += "\n";
    }
    
    return report;
  }
}

module.exports = DataValidator;