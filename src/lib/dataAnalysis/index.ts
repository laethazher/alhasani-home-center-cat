export * from './types';
export { analyzeFile, generateKPIs, generateChartSuggestions } from './analysisEngine';
export { analyzeWithAI, isAIAvailable, generateProfessionalReport } from './aiAnalyzer';
export { sendChatMessage, createChatSession, createChatContext, addMessageToSession, SUGGESTED_QUESTIONS } from './dataChat';
export { exportToPDF, exportReportToPDF } from './pdfExporter';
export { sendSmartAnalysisMessage, generateDataSummary, generateCustomAnalysis } from './smartAnalyzer';
export type { SmartAnalysisState } from './smartAnalyzer';

// محركات التحليل الجديدة
export { recognizeData, isDeliveryInstallationData, getRecognizedColumnName } from './dataRecognizer';
export type { DataType, RecognizedColumns, DataRecognitionResult, DataStructure, DataCategory } from './dataRecognizer';

export { calculateDeliveryInstallationKPIs, analyzeStages, calculateGeneralKPIs } from './kpiEngine';
export type { KPI, DeliveryAnalysis, InstallationAnalysis, DeliveryInstallationKPIs, StageAnalysis, StageCount } from './kpiEngine';

export { analyzeCustomerJourney, findProblematicCustomers, analyzeDeliveryInstallationRelation, analyzeRelationships } from './relationshipAnalyzer';
export type { CustomerJourney, CustomerDetail, ProblematicCustomer, OperationRelationship, DeliveryInstallationRelation, RelationshipSummary } from './relationshipAnalyzer';

export { analyzeCriticalCases, getQuickCriticalSummary, groupCriticalCasesByEmployee } from './criticalCasesAnalyzer';
export type { CriticalCase, CriticalCasesSummary, CriticalNote, QuickCriticalSummary, EmployeeCriticalCases } from './criticalCasesAnalyzer';

export { analyzeEmployeePerformance, getEmployeeDetails, getSupervisorDetails, compareEmployees, analyzeWorkDistribution, findProblematicEmployees } from './employeeAnalyzer';
export type { EmployeePerformance, SupervisorPerformance, TeamPerformanceSummary, EmployeeComparison, WorkDistribution, ProblematicEmployee } from './employeeAnalyzer';

export { generateDataStructureTable, generateDeliveryInvoicesTable, generateInstallationInvoicesTable, generateCustomerJourneyTable, generateStageDistributionTable, generateTopEmployeesTable, generateSupervisorsTable, generateCriticalCasesTable, generateAllTables, formatTableValue } from './tableGenerator';
export type { TableColumn, TableRow, ReportTable, AllReportTables } from './tableGenerator';

export { generateRecommendations, getPriorityIcon, getPriorityLabel, getRatingLabel } from './recommendationEngine';
export type { Recommendation, OperationalNote, FinalConclusion, RecommendationsSummary } from './recommendationEngine';

export {
  generateExecutiveNarrative,
  generateDataStructureNarrative,
  generateDeliveryNarrative,
  generateInstallationNarrative,
  generateCustomerJourneyNarrative,
  generateStageNarrative,
  generateTeamNarrative,
  generateCriticalCasesNarrative,
  generateConclusionNarrative,
  generateFullReportNarrative,
  generateSimpleNarrative,
} from './narrativeEngine';
export type {
  NarrativeSections,
  ExecutiveNarrative,
  DeliveryNarrative,
  InstallationNarrative,
  TeamNarrative,
  CriticalNarrative,
  ConclusionNarrative,
} from './narrativeEngine';
