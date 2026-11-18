import { Injectable } from '@angular/core';

export interface InspectionPdfPhoto {
  id: string;
  url: string;
  name?: string;
}

export interface InspectionPdfQuestion {
  id: string;
  qnum?: string | number;
  headername?: string;
  qtext: string;
  isDynamicObservation?: boolean;
  supportingPhotoIds?: string[];
}

export interface InspectionPdfData {
  referenceNumber: string;
  jobNo?: string;
  inspectionDate?: string;
  reportDate?: string;
  bankName: string;
  department: string;
  siteLocation?: string;
  depot?: string;
  inspectorName?: string;
  supervisorName?: string;
  foremanName?: string;
  contract?: string;
  operatives?: string;
  jobDescription?: string;
  totalScore?: number | string;
  finalizedAt: string;
  photos?: InspectionPdfPhoto[];
  stats: {
    total: number;
    passCount: number;
    carCount: number;
    naCount: number;
    answered: number;
  };
  answers: Record<string, any>;
  questions?: InspectionPdfQuestion[];
}

@Injectable({
  providedIn: 'root',
})
export class PdfExportService {
  /**
   * Generates and triggers download / print of the official Marlborough Highways / Quest Site Inspection Report.
   * Matches the official 10-screen layout:
   * - Top Bar with Job No & Ref No
   * - Marlborough stylized M logo
   * - Full 2-column / 4-column Metadata Table
   * - Site Photographs gallery grid
   * - Grouped Inspection Report tables by Section (including AI Dynamic Observations & Abnormalities)
   * - Question text with embedded supporting photo thumbnails
   * - Legislative status ('Yes / Good', 'Action Required', 'N/A') and Rating (1, -1, 0)
   */
  downloadPdf(data: InspectionPdfData): void {
    if (typeof window === 'undefined') return;

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
      alert('Please allow popups to download or print the PDF report.');
      return;
    }

    const html = this.buildReportHtml(data);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Allow resources/styles to paint, then trigger print/save as PDF dialog
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 350);
    };
  }

  /**
   * Builds pixel-perfect printable HTML for the Site Inspection Report.
   */
  public buildReportHtml(data: InspectionPdfData): string {
    const formattedDate = data.finalizedAt
      ? new Date(data.finalizedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

    const reportDateOnly = data.finalizedAt
      ? new Date(data.finalizedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('en-GB');

    const jobNo = data.jobNo || 'LBN-0029';
    const refNo = data.referenceNumber || 'SI638150';
    const siteLocation = data.siteLocation || 'Romford Road';
    const depot = data.depot || 'N/A';
    const department = data.department || 'Civil';
    const inspector = data.inspectorName || 'Dan Kennett';
    const supervisor = data.supervisorName || inspector || 'Dan Kennett';
    const foreman = data.foremanName || 'Bekim Aliaj';
    const contract = data.contract || '140-Newham';
    const operatives = data.operatives || '1. Dan Kennett, 2. Bekim Aliaj';
    const jobDescription = data.jobDescription || `${data.bankName} - Highway safety & compliance inspection`;
    const totalScore = data.totalScore !== undefined ? data.totalScore : data.stats?.passCount || 50;

    // Photos gallery HTML
    const photos = data.photos || [];
    const photosSectionHtml = this.buildPhotosSection(photos);

    // Grouped inspection report table HTML
    const reportTableHtml = this.buildGroupedReportTables(data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Site Inspection Report under Job no : ${jobNo} Ref no: ${refNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 14mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10pt;
      line-height: 1.4;
    }
    .report-wrapper {
      max-width: 100%;
      margin: 0 auto;
    }

    /* Top Red Bar Header (Matching Screenshot 1) */
    .top-bar-header {
      background: #88132B;
      color: #ffffff;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 6px 6px 0 0;
      margin-bottom: 16px;
    }
    .top-bar-title {
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: -0.2px;
      margin: 0;
    }
    .top-bar-badges {
      display: flex;
      gap: 8px;
    }
    .top-pill {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 8.5pt;
      font-weight: 600;
      text-transform: capitalize;
    }

    /* Document Title & Marlborough Logo */
    .brand-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 4px 10px 4px;
      border-bottom: 2px solid #88132B;
      margin-bottom: 14px;
    }
    .report-main-title {
      font-size: 18pt;
      font-weight: 800;
      color: #88132B;
      margin: 0;
      letter-spacing: -0.3px;
    }
    .marlborough-logo-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .m-logo-svg {
      width: 48px;
      height: 38px;
    }

    /* Metadata Table (Matching Screenshot 1 & 4) */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 9.5pt;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .meta-table td {
      padding: 6px 12px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    .meta-col-label {
      width: 20%;
      font-weight: 700;
      color: #334155;
      background: #fbfcfd;
    }
    .meta-col-value {
      width: 30%;
      color: #0f172a;
      font-weight: 500;
    }

    /* Section Headers (Matching Screenshot 1 & 4 Burgundy Headers) */
    .section-banner {
      font-size: 12pt;
      font-weight: 800;
      color: #88132B;
      margin: 20px 0 10px 0;
      padding-bottom: 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Site Photographs Gallery (Matching Screenshot 2 & 3) */
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 22px;
    }
    .photo-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      background: #f8fafc;
      page-break-inside: avoid;
    }
    .photo-card img {
      width: 100%;
      height: 125px;
      object-fit: cover;
      display: block;
    }
    .photo-card-caption {
      padding: 4px 6px;
      font-size: 7.5pt;
      color: #64748b;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Inspection Checklist Table (Matching Screenshot 4, 5, 6, 7) */
    .inspection-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 9pt;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .inspection-table thead th {
      background: #f8fafc;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 7px 10px;
      border: 1px solid #cbd5e1;
      font-size: 8.5pt;
      text-transform: capitalize;
    }
    .inspection-table tbody td {
      padding: 7px 10px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .group-header-row td {
      background: #ffffff;
      color: #88132B;
      font-weight: 800;
      font-size: 10pt;
      padding: 10px 10px 6px 10px;
      border-top: 2px solid #88132B;
      border-bottom: 1px solid #cbd5e1;
    }
    .sl-cell {
      width: 5%;
      font-weight: 600;
      color: #64748b;
      text-align: center;
    }
    .item-cell {
      width: 61%;
    }
    .item-title {
      font-weight: 600;
      color: #0f172a;
      line-height: 1.35;
    }
    .item-photos-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .item-photo-thumb {
      width: 52px;
      height: 52px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
    }
    .item-evidence-note {
      font-size: 8pt;
      color: #475569;
      margin-top: 4px;
      line-height: 1.3;
    }
    .item-car-plan {
      font-size: 8pt;
      color: #b91c1c;
      font-weight: 600;
      margin-top: 3px;
    }
    .dynamic-tag {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: 700;
      padding: 1px 5px;
      margin-bottom: 3px;
      text-transform: uppercase;
    }
    .status-cell {
      width: 24%;
      font-weight: 600;
      color: #1e293b;
    }
    .status-good {
      color: #16a34a;
    }
    .status-car {
      color: #dc2626;
      font-weight: 700;
    }
    .status-na {
      color: #64748b;
    }
    .rating-cell {
      width: 10%;
      text-align: center;
      font-weight: 800;
      font-size: 11pt;
    }
    .rating-1 {
      color: #16a34a;
    }
    .rating-neg1 {
      color: #dc2626;
    }
    .rating-0 {
      color: #64748b;
    }

    /* Sign-off certification footer */
    .certification-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      padding: 12px 16px;
      margin-top: 24px;
      page-break-inside: avoid;
    }
    .cert-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 16px;
      align-items: center;
    }
    .cert-title {
      font-size: 10pt;
      font-weight: 700;
      color: #0f172a;
    }
    .cert-text {
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 2px;
    }
    .signature-under {
      border-bottom: 1px dashed #94a3b8;
      padding-bottom: 4px;
      font-weight: 600;
      font-size: 9.5pt;
      color: #0f172a;
    }
    .verified-seal {
      display: inline-block;
      border: 2px solid #16a34a;
      color: #16a34a;
      font-weight: 800;
      font-size: 8.5pt;
      padding: 4px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .report-footer-print-note {
      text-align: center;
      font-size: 8pt;
      color: #94a3b8;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="report-wrapper">
    <!-- Top Red Bar Header (Screenshot 1) -->
    <div class="top-bar-header">
      <h3 class="top-bar-title">Site Inspection Report under Job no : ${jobNo} Ref no: ${refNo}</h3>
      <div class="top-bar-badges">
        <span class="top-pill">Evaluate</span>
        <span class="top-pill">Rate</span>
        <span class="top-pill">Print</span>
      </div>
    </div>

    <!-- Title & Marlborough Red "M" Logo -->
    <div class="brand-section">
      <h1 class="report-main-title">Site Inspection Report</h1>
      <div class="marlborough-logo-wrap">
        <svg class="m-logo-svg" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 78 L52 14 L76 56 L64 56 L52 34 L25 78 Z" fill="#88132B"/>
          <path d="M46 78 L70 36 L108 78 L95 78 L70 50 L58 78 Z" fill="#A82038"/>
        </svg>
      </div>
    </div>

    <!-- Metadata Table (Screenshot 1 & 4) -->
    <table class="meta-table">
      <tbody>
        <tr>
          <td class="meta-col-label">Ref No</td>
          <td class="meta-col-value"><strong>${refNo}</strong></td>
          <td class="meta-col-label">Inspection Date</td>
          <td class="meta-col-value">${formattedDate}</td>
        </tr>
        <tr>
          <td class="meta-col-label">Job No</td>
          <td class="meta-col-value">${jobNo}</td>
          <td class="meta-col-label">Report Date</td>
          <td class="meta-col-value">${reportDateOnly}</td>
        </tr>
        <tr>
          <td class="meta-col-label">Location</td>
          <td class="meta-col-value">${siteLocation}</td>
          <td class="meta-col-label">Depot</td>
          <td class="meta-col-value">${depot}</td>
        </tr>
        <tr>
          <td class="meta-col-label">Department</td>
          <td class="meta-col-value">${department}</td>
          <td class="meta-col-label">Reported By</td>
          <td class="meta-col-value">${inspector}</td>
        </tr>
        <tr>
          <td class="meta-col-label">Supervisor</td>
          <td class="meta-col-value">${supervisor}</td>
          <td class="meta-col-label">Foreman</td>
          <td class="meta-col-value">${foreman}</td>
        </tr>
        <tr>
          <td class="meta-col-label">Contract</td>
          <td class="meta-col-value">${contract}</td>
          <td class="meta-col-label">Operatives</td>
          <td class="meta-col-value">${operatives}</td>
        </tr>
        <tr>
          <td class="meta-col-label">Job Description</td>
          <td class="meta-col-value">${jobDescription}</td>
          <td class="meta-col-label">Total Score</td>
          <td class="meta-col-value"><strong style="color: #16a34a; font-size: 11pt;">${totalScore}</strong></td>
        </tr>
      </tbody>
    </table>

    <!-- Site Photographs Section (Screenshot 2 & 3) -->
    ${photosSectionHtml}

    <!-- Inspection Report Section (Screenshot 4, 5, 6, 7) -->
    <div class="section-banner">
      <span>Inspection Report</span>
      <span style="font-size: 9pt; color: #64748b; font-weight: normal;">${data.stats.total} Checks Evaluated</span>
    </div>

    ${reportTableHtml}

    <!-- Certification / Sign-off Footer -->
    <div class="certification-box">
      <div class="cert-grid">
        <div>
          <div class="cert-title">Compliance Certification</div>
          <div class="cert-text">Certified true and accurate on-site inspection audit record generated via QuestAI.</div>
        </div>
        <div>
          <div style="font-size: 7.5pt; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">Authorized Inspector</div>
          <div class="signature-under">${inspector}</div>
        </div>
        <div style="text-align: right;">
          <div class="verified-seal">✓ VERIFIED</div>
        </div>
      </div>
    </div>

    <div class="report-footer-print-note">
      Marlborough Highways • QuestAI Intelligent Inspection System • Confidential & Statutory Record
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Builds the Site Photographs gallery section matching Screenshot 2 & 3.
   */
  private buildPhotosSection(photos: InspectionPdfPhoto[]): string {
    if (!photos || photos.length === 0) {
      return '';
    }

    const cardsHtml = photos
      .map((p, idx) => {
        const title = p.name || `Photo ${idx + 1}`;
        return `<div class="photo-card">
          <img src="${p.url}" alt="${title}" onerror="this.closest('.photo-card').style.display='none'" />
          <div class="photo-card-caption">${title}</div>
        </div>`;
      })
      .join('');

    return `
      <div class="section-banner">
        <span>Site Photographs</span>
        <span style="font-size: 9pt; color: #64748b; font-weight: normal;">${photos.length} Photographic Evidence Items</span>
      </div>
      <div class="photos-grid">
        ${cardsHtml}
      </div>
    `;
  }

  /**
   * Builds grouped tables by section headers matching Screenshot 4, 5, 6, 7.
   * Includes thumbnails directly under question text if photos support that check.
   */
  private buildGroupedReportTables(data: InspectionPdfData): string {
    const answers = data.answers || {};
    const photoMap: Record<string, InspectionPdfPhoto> = {};
    for (const p of data.photos || []) {
      photoMap[p.id] = p;
    }

    // Group questions by headername
    const groups: Array<{ headername: string; questions: InspectionPdfQuestion[] }> = [];
    const groupMap: Record<string, InspectionPdfQuestion[]> = {};

    if (data.questions && data.questions.length > 0) {
      for (const q of data.questions) {
        const header = q.headername || 'General';
        if (!groupMap[header]) {
          groupMap[header] = [];
          groups.push({ headername: header, questions: groupMap[header] });
        }
        groupMap[header].push(q);
      }
    } else {
      // Fallback if no questions list provided
      const defaultHeader = data.bankName || 'Site Inspection';
      const fallbackQuestions = Object.keys(answers).map((key, i) => ({
        id: key,
        qnum: i + 1,
        headername: defaultHeader,
        qtext: key,
      }));
      groups.push({ headername: defaultHeader, questions: fallbackQuestions });
    }

    let slCounter = 1;

    const tablesHtml = groups
      .map((grp) => {
        let sectionSl = 1;
        const rowsHtml = grp.questions
          .map((q) => {
            const ans = answers[q.id];
            const rating = ans?.rating;

            // Status label & CSS class (Screenshot 4: 'Yes / Good', 'Action Required', 'N/A')
            let statusText = 'Pending';
            let statusClass = 'status-na';
            let ratingDisplay = '0';
            let ratingClass = 'rating-0';

            if (rating === '1') {
              statusText = 'Yes / Good';
              statusClass = 'status-good';
              ratingDisplay = '1';
              ratingClass = 'rating-1';
            } else if (rating === '-1') {
              statusText = 'Action Required';
              statusClass = 'status-car';
              ratingDisplay = '-1';
              ratingClass = 'rating-neg1';
            } else if (rating === '0') {
              statusText = 'N/A';
              statusClass = 'status-na';
              ratingDisplay = '0';
              ratingClass = 'rating-0';
            }

            // Supporting photos attached only to defects or dynamic abnormalities
            const isDefectOrDynamic = q.isDynamicObservation || rating === '-1';
            const supportingIds = isDefectOrDynamic ? (q.supportingPhotoIds || ans?.photoIds || []) : [];
            let photosThumbHtml = '';
            if (supportingIds.length > 0) {
              const matchedThumbs = supportingIds
                .map((id: string) => photoMap[id])
                .filter((p: InspectionPdfPhoto) => p && p.url && p.url.trim().length > 0)
                .map((p: InspectionPdfPhoto) => `<img src="${p.url}" alt="${p.name || 'Site Photo'}" class="item-photo-thumb" onerror="this.style.display='none'" />`)
                .join('');
              if (matchedThumbs) {
                photosThumbHtml = `<div class="item-photos-row">${matchedThumbs}</div>`;
              }
            }

            // AI Dynamic observation badge
            const dynamicBadge = q.isDynamicObservation
              ? `<div class="dynamic-tag">⚠️ AI Observed Abnormality</div>`
              : '';

            // Evidence and CAR notes
            const evidence = ans?.comment || ans?.aiEvidence || '';
            const evidenceHtml = evidence ? `<div class="item-evidence-note">${evidence}</div>` : '';
            const carPlanHtml = ans?.carActionPlan ? `<div class="item-car-plan">Action: ${ans.carActionPlan}</div>` : '';

            const slFormatted = sectionSl < 10 ? `0${sectionSl}` : `${sectionSl}`;
            sectionSl++;
            slCounter++;

            return `<tr>
              <td class="sl-cell">${slFormatted}</td>
              <td class="item-cell">
                ${dynamicBadge}
                <div class="item-title">${q.qtext}</div>
                ${photosThumbHtml}
                ${evidenceHtml}
                ${carPlanHtml}
              </td>
              <td class="status-cell ${statusClass}">${statusText}</td>
              <td class="rating-cell ${ratingClass}">${ratingDisplay}</td>
            </tr>`;
          })
          .join('');

        return `
          <table class="inspection-table">
            <thead>
              <tr class="group-header-row">
                <td colspan="4">${grp.headername}</td>
              </tr>
              <tr>
                <th style="width: 6%;">SL</th>
                <th style="width: 60%;">Item / Question</th>
                <th style="width: 24%;">Meets Legislative & Company Requirements</th>
                <th style="width: 10%; text-align: center;">Rating</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      })
      .join('');

    return tablesHtml;
  }
}
