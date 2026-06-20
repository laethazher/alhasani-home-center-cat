import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type {
  ProfessionalReportData,
  AnalysisReport,
  PDFExportOptions,
} from './types';
import { RATING_LABELS, PRIORITY_LABELS, CATEGORY_LABELS, DATA_TYPE_LABELS } from './types';

const DEFAULT_OPTIONS: PDFExportOptions = {
  includeCharts: true,
  includeRawData: false,
  includeChat: false,
  language: 'ar',
  paperSize: 'a4',
  orientation: 'portrait',
};

function formatArabicNumber(num: number): string {
  return num.toLocaleString('ar-IQ');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateReportHTML(
  professionalReport: ProfessionalReportData,
  rawReport: AnalysisReport
): string {
  const styles = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
        direction: rtl;
        text-align: right;
        background: white;
        color: #1a1a1a;
        line-height: 1.6;
        font-size: 12px;
      }
      
      .page {
        width: 210mm;
        min-height: 297mm;
        padding: 20mm;
        background: white;
        page-break-after: always;
      }
      
      .page:last-child {
        page-break-after: auto;
      }
      
      /* صفحة الغلاف */
      .cover-page {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      
      .cover-header {
        background: linear-gradient(135deg, #0078b4 0%, #005a8c 100%);
        width: calc(100% + 40mm);
        margin: -20mm -20mm 0 -20mm;
        padding: 40mm 20mm;
        color: white;
      }
      
      .cover-title {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 10px;
      }
      
      .cover-subtitle {
        font-size: 16px;
        opacity: 0.9;
        margin-bottom: 15px;
      }
      
      .cover-meta {
        font-size: 14px;
        opacity: 0.8;
      }
      
      .cover-info {
        margin-top: 40px;
        font-size: 14px;
        color: #555;
      }
      
      .cover-info p {
        margin: 8px 0;
      }
      
      /* فهرس المحتويات */
      .toc-title {
        font-size: 22px;
        color: #006496;
        margin-bottom: 25px;
        padding-bottom: 10px;
        border-bottom: 3px solid #006496;
      }
      
      .toc-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        margin: 5px 0;
        border-radius: 5px;
        transition: background 0.2s;
      }
      
      .toc-item:nth-child(odd) {
        background: #f8f9fa;
      }
      
      .toc-number {
        background: #0078b4;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 12px;
      }
      
      .toc-text {
        flex: 1;
        margin-right: 15px;
        font-size: 14px;
      }
      
      /* عناوين الأقسام */
      .section-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 30px 0 20px 0;
        padding-bottom: 10px;
        border-bottom: 2px solid #e5e5e5;
      }
      
      .section-number {
        background: linear-gradient(135deg, #0078b4 0%, #005a8c 100%);
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 16px;
      }
      
      .section-title {
        font-size: 18px;
        font-weight: 700;
        color: #1a1a1a;
      }
      
      /* الجداول */
      .table-container {
        margin: 15px 0;
        overflow: hidden;
        border-radius: 8px;
        border: 1px solid #e5e5e5;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      
      th {
        background: linear-gradient(135deg, #0078b4 0%, #005a8c 100%);
        color: white;
        padding: 12px 10px;
        font-weight: 600;
        text-align: right;
      }
      
      td {
        padding: 10px;
        border-bottom: 1px solid #eee;
        text-align: right;
      }
      
      tr:nth-child(even) {
        background: #f8f9fa;
      }
      
      tr:hover {
        background: #f0f7ff;
      }
      
      /* بطاقات KPI */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin: 20px 0;
      }
      
      .kpi-card {
        background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
        border: 1px solid #e5e5e5;
        border-radius: 10px;
        padding: 15px;
        text-align: center;
      }
      
      .kpi-value {
        font-size: 24px;
        font-weight: 700;
        color: #0078b4;
      }
      
      .kpi-title {
        font-size: 12px;
        color: #666;
        margin-top: 5px;
      }
      
      .kpi-description {
        font-size: 10px;
        color: #888;
        margin-top: 3px;
      }
      
      /* نقاط مهمة */
      .highlights {
        background: linear-gradient(135deg, #f0f7ff 0%, #e6f3ff 100%);
        border-right: 4px solid #0078b4;
        padding: 15px 20px;
        margin: 15px 0;
        border-radius: 0 8px 8px 0;
      }
      
      .highlights-title {
        font-size: 14px;
        font-weight: 700;
        color: #0078b4;
        margin-bottom: 10px;
      }
      
      .highlight-item {
        padding: 5px 0;
        padding-right: 20px;
        position: relative;
        font-size: 12px;
      }
      
      .highlight-item::before {
        content: "●";
        position: absolute;
        right: 0;
        color: #0078b4;
      }
      
      /* الحالات الحرجة */
      .critical-card {
        border-radius: 10px;
        padding: 15px;
        margin: 10px 0;
        color: white;
      }
      
      .critical-card.critical {
        background: linear-gradient(135deg, #dc3545 0%, #b02a37 100%);
      }
      
      .critical-card.warning {
        background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
        color: #1a1a1a;
      }
      
      .critical-card.conflict {
        background: linear-gradient(135deg, #fd7e14 0%, #dc6a00 100%);
      }
      
      .critical-card.info {
        background: linear-gradient(135deg, #0dcaf0 0%, #0aa2c0 100%);
      }
      
      .critical-title {
        font-size: 14px;
        font-weight: 700;
        margin-bottom: 5px;
      }
      
      .critical-count {
        font-size: 11px;
        opacity: 0.9;
        margin-bottom: 8px;
      }
      
      .critical-description {
        font-size: 11px;
        opacity: 0.95;
      }
      
      /* التوصيات */
      .recommendation-card {
        display: flex;
        gap: 12px;
        padding: 15px;
        margin: 10px 0;
        background: #f8f9fa;
        border-radius: 10px;
        border-right: 4px solid;
      }
      
      .recommendation-card.high {
        border-color: #dc3545;
      }
      
      .recommendation-card.medium {
        border-color: #ffc107;
      }
      
      .recommendation-card.low {
        border-color: #0dcaf0;
      }
      
      .recommendation-number {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #0078b4;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 12px;
        flex-shrink: 0;
      }
      
      .recommendation-content {
        flex: 1;
      }
      
      .recommendation-title {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 5px;
      }
      
      .recommendation-meta {
        font-size: 10px;
        color: #666;
        margin-bottom: 5px;
      }
      
      .recommendation-description {
        font-size: 11px;
        color: #444;
      }
      
      /* الاستنتاج */
      .conclusion-rating {
        text-align: center;
        margin: 25px 0;
      }
      
      .rating-circle {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        color: white;
        font-weight: 700;
      }
      
      .rating-circle.excellent {
        background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%);
      }
      
      .rating-circle.good {
        background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
        color: #1a1a1a;
      }
      
      .rating-circle.poor {
        background: linear-gradient(135deg, #dc3545 0%, #b02a37 100%);
      }
      
      .rating-score {
        font-size: 32px;
      }
      
      .rating-label {
        font-size: 12px;
        margin-top: 5px;
      }
      
      .summary-text {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 10px;
        margin: 20px 0;
        font-size: 13px;
        line-height: 1.8;
      }
      
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin: 15px 0;
      }
      
      .metric-item {
        display: flex;
        justify-content: space-between;
        padding: 10px 15px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      
      .metric-label {
        font-size: 12px;
        color: #666;
      }
      
      .metric-value {
        font-size: 12px;
        font-weight: 600;
        color: #0078b4;
      }
      
      /* الملاحظات النهائية */
      .final-notes {
        background: #fff3cd;
        border-right: 4px solid #ffc107;
        padding: 15px 20px;
        margin: 15px 0;
        border-radius: 0 8px 8px 0;
      }
      
      .final-notes-title {
        font-size: 14px;
        font-weight: 700;
        color: #856404;
        margin-bottom: 10px;
      }
      
      .note-item {
        padding: 5px 0;
        padding-right: 20px;
        position: relative;
        font-size: 12px;
        color: #856404;
      }
      
      .note-item::before {
        content: "⚠";
        position: absolute;
        right: 0;
      }
      
      /* Footer */
      .page-footer {
        position: absolute;
        bottom: 15mm;
        left: 20mm;
        right: 20mm;
        text-align: center;
        font-size: 10px;
        color: #888;
        border-top: 1px solid #e5e5e5;
        padding-top: 10px;
      }
      
      /* تحليل عمود */
      .column-analysis {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
        margin: 10px 0;
      }
      
      .column-name {
        font-weight: 600;
        color: #0078b4;
        margin-bottom: 5px;
      }
      
      .column-type {
        font-size: 10px;
        color: #666;
        background: #e5e5e5;
        padding: 2px 8px;
        border-radius: 10px;
        display: inline-block;
        margin-bottom: 8px;
      }
      
      .column-desc {
        font-size: 11px;
        color: #444;
      }
      
      /* قواعد التصنيف */
      .classification-rules {
        margin: 15px 0;
      }
      
      .rule-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 8px;
        margin: 5px 0;
      }
      
      .rule-category {
        background: #0078b4;
        color: white;
        padding: 4px 12px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: 600;
      }
      
      .rule-condition {
        flex: 1;
        font-size: 11px;
      }
      
      .rule-stats {
        text-align: left;
        font-size: 11px;
        color: #666;
      }
      
      /* Analysis card */
      .analysis-card {
        background: white;
        border: 1px solid #e5e5e5;
        border-radius: 10px;
        margin: 15px 0;
        overflow: hidden;
      }
      
      .analysis-card-header {
        background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
        padding: 12px 15px;
        border-bottom: 1px solid #e5e5e5;
      }
      
      .analysis-card-title {
        font-size: 14px;
        font-weight: 600;
        color: #1a1a1a;
      }
      
      .analysis-card-body {
        padding: 15px;
      }
      
      .analysis-note {
        background: #e8f5e9;
        border-right: 3px solid #4caf50;
        padding: 10px 15px;
        margin-top: 10px;
        border-radius: 0 5px 5px 0;
        font-size: 11px;
        color: #2e7d32;
      }
    </style>
  `;

  // صفحة الغلاف
  const coverPage = `
    <div class="page cover-page">
      <div class="cover-header">
        <div class="cover-title">${escapeHtml(professionalReport.title)}</div>
        <div class="cover-subtitle">${escapeHtml(professionalReport.subtitle)}</div>
        <div class="cover-meta">${formatArabicNumber(professionalReport.metadata.rowCount)} سجل | ${professionalReport.metadata.columnCount} عمود</div>
      </div>
      <div class="cover-info">
        <p>تاريخ التقرير: ${new Date(professionalReport.generatedAt).toLocaleDateString('ar-IQ')}</p>
        <p>الملف: ${escapeHtml(professionalReport.metadata.fileName)}</p>
        ${professionalReport.metadata.dateRange ? `
          <p>الفترة: ${professionalReport.metadata.dateRange.from} إلى ${professionalReport.metadata.dateRange.to}</p>
        ` : ''}
      </div>
    </div>
  `;

  // فهرس المحتويات
  const tocItems = [
    { num: 1, title: 'الملخص التنفيذي (KPIs)' },
    { num: 2, title: 'هيكل البيانات' },
    { num: 3, title: 'تحليل التجهيز' },
    { num: 4, title: 'تحليل التركيب' },
    { num: 5, title: 'العلاقة بين التجهيز والتركيب' },
    { num: 6, title: 'تحليل Stage' },
    { num: 7, title: 'تحليل الموظفين والمشرفين' },
    { num: 8, title: 'الحالات الحرجة' },
    { num: 9, title: 'الرسوم البيانية' },
    { num: 10, title: 'التوصيات التنفيذية' },
    { num: 11, title: 'الاستنتاج النهائي' },
  ];

  const tocPage = `
    <div class="page">
      <h2 class="toc-title">فهرس المحتويات</h2>
      ${tocItems.map(item => `
        <div class="toc-item">
          <span class="toc-text">${escapeHtml(item.title)}</span>
          <span class="toc-number">${item.num}</span>
        </div>
      `).join('')}
    </div>
  `;

  // الملخص التنفيذي
  const executiveSummaryPage = `
    <div class="page">
      <div class="section-header">
        <div class="section-number">1</div>
        <div class="section-title">الملخص التنفيذي</div>
      </div>
      
      <div class="kpi-grid">
        ${professionalReport.executiveSummary.kpis.map(kpi => `
          <div class="kpi-card">
            <div class="kpi-value">${escapeHtml(String(kpi.value))}</div>
            <div class="kpi-title">${escapeHtml(kpi.title)}</div>
            ${kpi.description ? `<div class="kpi-description">${escapeHtml(kpi.description)}</div>` : ''}
          </div>
        `).join('')}
      </div>
      
      <div class="summary-text">
        ${escapeHtml(professionalReport.executiveSummary.summary)}
      </div>
      
      ${professionalReport.executiveSummary.highlights.length > 0 ? `
        <div class="highlights">
          <div class="highlights-title">أبرز النقاط</div>
          ${professionalReport.executiveSummary.highlights.map(h => `
            <div class="highlight-item">${escapeHtml(h)}</div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  // فهم البيانات
  const dataUnderstandingPage = `
    <div class="page">
      <div class="section-header">
        <div class="section-number">2</div>
        <div class="section-title">${escapeHtml(professionalReport.dataUnderstanding.title)}</div>
      </div>
      
      <p style="margin-bottom: 15px; font-size: 12px;">${escapeHtml(professionalReport.dataUnderstanding.description)}</p>
      
      ${professionalReport.dataUnderstanding.columns.length > 0 ? `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>العمود</th>
                <th>الوصف</th>
                <th>النوع</th>
                <th>مثال</th>
              </tr>
            </thead>
            <tbody>
              ${professionalReport.dataUnderstanding.columns.map(col => `
                <tr>
                  <td><strong>${escapeHtml(col.columnName)}</strong></td>
                  <td>${escapeHtml(col.description)}</td>
                  <td>${escapeHtml(DATA_TYPE_LABELS[col.dataType as keyof typeof DATA_TYPE_LABELS] || col.dataType)}</td>
                  <td>${escapeHtml(col.example || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
      
      ${professionalReport.dataUnderstanding.classificationRules.length > 0 ? `
        <div class="section-header" style="margin-top: 25px;">
          <div class="section-title" style="font-size: 14px;">قواعد التصنيف المعتمدة</div>
        </div>
        <div class="classification-rules">
          ${professionalReport.dataUnderstanding.classificationRules.map(rule => `
            <div class="rule-item">
              <span class="rule-category">${escapeHtml(rule.category)}</span>
              <span class="rule-condition">${escapeHtml(rule.condition)}</span>
              <span class="rule-stats">${formatArabicNumber(rule.count)} (${rule.percentage?.toFixed(1) || 0}%)</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  // التحليلات التفصيلية
  let detailedAnalysisPages = '';
  if (professionalReport.detailedAnalysis.length > 0) {
    detailedAnalysisPages = `
      <div class="page">
        <div class="section-header">
          <div class="section-number">3</div>
          <div class="section-title">التحليلات التفصيلية</div>
        </div>
        
        ${professionalReport.detailedAnalysis.map(analysis => `
          <div class="analysis-card">
            <div class="analysis-card-header">
              <div class="analysis-card-title">${escapeHtml(analysis.title)}</div>
            </div>
            <div class="analysis-card-body">
              ${analysis.description ? `<p style="margin-bottom: 10px; font-size: 11px; color: #666;">${escapeHtml(analysis.description)}</p>` : ''}
              
              ${analysis.tableRows.length > 0 ? `
                <div class="table-container">
                  <table>
                    <thead>
                      <tr>
                        ${analysis.tableHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
                      </tr>
                    </thead>
                    <tbody>
                      ${analysis.tableRows.map(row => `
                        <tr>
                          <td>${escapeHtml(row.indicator)}</td>
                          <td>${typeof row.value === 'number' ? formatArabicNumber(row.value) : escapeHtml(String(row.value))}</td>
                          <td>${escapeHtml(row.percentage || '-')}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              
              ${analysis.analysis ? `
                <div class="analysis-note">
                  <strong>تحليل:</strong> ${escapeHtml(analysis.analysis)}
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // الحالات الحرجة
  let criticalCasesPage = '';
  if (professionalReport.criticalCases.length > 0) {
    criticalCasesPage = `
      <div class="page">
        <div class="section-header">
          <div class="section-number">8</div>
          <div class="section-title">الحالات الحرجة والتعارضات</div>
        </div>
        
        ${professionalReport.criticalCases.map(caseItem => `
          <div class="critical-card ${caseItem.type}">
            <div class="critical-title">${escapeHtml(caseItem.title)}</div>
            <div class="critical-count">المتأثرون: ${formatArabicNumber(caseItem.affectedCount)}</div>
            <div class="critical-description">${escapeHtml(caseItem.description)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // التوصيات
  let recommendationsPage = '';
  if (professionalReport.recommendations.length > 0) {
    recommendationsPage = `
      <div class="page">
        <div class="section-header">
          <div class="section-number">10</div>
          <div class="section-title">التوصيات التنفيذية</div>
        </div>
        
        ${professionalReport.recommendations.map((rec, idx) => `
          <div class="recommendation-card ${rec.priority}">
            <div class="recommendation-number">${idx + 1}</div>
            <div class="recommendation-content">
              <div class="recommendation-title">${escapeHtml(rec.title)}</div>
              <div class="recommendation-meta">
                الأولوية: ${escapeHtml(PRIORITY_LABELS[rec.priority])} | الفئة: ${escapeHtml(CATEGORY_LABELS[rec.category])}
              </div>
              <div class="recommendation-description">${escapeHtml(rec.description)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // الاستنتاج النهائي
  const ratingClass = professionalReport.conclusion.ratingScore >= 80 
    ? 'excellent' 
    : professionalReport.conclusion.ratingScore >= 60 
      ? 'good' 
      : 'poor';

  const conclusionPage = `
    <div class="page">
      <div class="section-header">
        <div class="section-number">11</div>
        <div class="section-title">الاستنتاج النهائي</div>
      </div>
      
      <div class="conclusion-rating">
        <div class="rating-circle ${ratingClass}">
          <div class="rating-score">${professionalReport.conclusion.ratingScore}%</div>
          <div class="rating-label">${escapeHtml(RATING_LABELS[professionalReport.conclusion.overallRating])}</div>
        </div>
      </div>
      
      <div class="summary-text">
        ${escapeHtml(professionalReport.conclusion.summary)}
      </div>
      
      ${professionalReport.conclusion.keyMetrics.length > 0 ? `
        <div class="highlights">
          <div class="highlights-title">المقاييس الرئيسية</div>
          <div class="metrics-grid">
            ${professionalReport.conclusion.keyMetrics.map(metric => `
              <div class="metric-item">
                <span class="metric-label">${escapeHtml(metric.label)}</span>
                <span class="metric-value">${escapeHtml(metric.value)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${professionalReport.conclusion.finalNotes.length > 0 ? `
        <div class="final-notes">
          <div class="final-notes-title">ملاحظات ختامية</div>
          ${professionalReport.conclusion.finalNotes.map(note => `
            <div class="note-item">${escapeHtml(note)}</div>
          `).join('')}
        </div>
      ` : ''}
      
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #888; font-size: 10px;">
        <p>تم إعداد هذا التقرير تلقائياً بواسطة مركز تحليل البيانات الذكي</p>
        <p style="margin-top: 5px;">${escapeHtml(professionalReport.metadata.fileName)} | ${new Date(professionalReport.generatedAt).toLocaleString('ar-IQ')}</p>
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${styles}
    </head>
    <body>
      ${coverPage}
      ${tocPage}
      ${executiveSummaryPage}
      ${dataUnderstandingPage}
      ${detailedAnalysisPages}
      ${criticalCasesPage}
      ${recommendationsPage}
      ${conclusionPage}
    </body>
    </html>
  `;
}

export async function exportToPDF(
  professionalReport: ProfessionalReportData,
  rawReport: AnalysisReport,
  options: Partial<PDFExportOptions> = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const htmlContent = generateReportHTML(professionalReport, rawReport);
  
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm';
  document.body.appendChild(container);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const pages = container.querySelectorAll('.page');
  const doc = new jsPDF({
    orientation: opts.orientation,
    unit: 'mm',
    format: opts.paperSize,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i] as HTMLElement;
      
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      if (i > 0) {
        doc.addPage();
      }

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(128);
      doc.text(`${i} / ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    }

    const fileName = `تقرير_${professionalReport.metadata.fileName.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportReportToPDF(
  professionalReport: ProfessionalReportData,
  rawReport: AnalysisReport
): Promise<void> {
  return exportToPDF(professionalReport, rawReport);
}
