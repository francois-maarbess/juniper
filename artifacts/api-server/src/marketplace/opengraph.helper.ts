export interface TutorOgData {
  id: string;
  displayName: string;
  headline: string | null;
  biography: string | null;
  hourlyRateCents: number;
  subjects: string[];
  averageRating: number;
  reviewCount: number;
  completedSessions: number;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateTutorOpenGraphHtml(tutor: TutorOgData, appOrigin: string, apiOrigin: string): string {
  const subjectsList = tutor.subjects.length > 0 ? tutor.subjects.slice(0, 4).join(', ') : 'University Subjects';
  const rateText = tutor.hourlyRateCents > 0 ? `$${Math.round(tutor.hourlyRateCents / 100)}/hr` : 'Custom rate';
  const ratingText = tutor.reviewCount > 0 ? `★ ${tutor.averageRating.toFixed(1)} (${tutor.reviewCount} reviews) · ` : '';
  const headlineText = tutor.headline ? ` · ${tutor.headline}` : '';
  
  const title = `${escapeHtml(tutor.displayName)} - Tutor on Juniper (${rateText})`;
  const description = escapeHtml(
    `${ratingText}${subjectsList}${headlineText}. Tutor profile on Juniper. Payment is arranged directly between learner and tutor.`
  );
  
  const profileUrl = `${appOrigin}/tutor/${tutor.id}`;
  // SVG og-image rendered by API server
  const ogImageUrl = `${apiOrigin}/marketplace/tutors/${tutor.id}/og-image.svg`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${profileUrl}" />

  <!-- OpenGraph Metadata for WhatsApp, Facebook, iMessage -->
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Juniper Tutoring" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${profileUrl}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:secure_url" content="${ogImageUrl}" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@junipertutoring" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImageUrl}" />

  <!-- Theme Color (Juniper Forest Green) -->
  <meta name="theme-color" content="#1B4332" />
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8F9FA;
      color: #1B4332;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E1EBDD;
      border-radius: 24px;
      padding: 32px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(27, 67, 50, 0.08);
    }
    .badge {
      display: inline-block;
      background: #E1EBDD;
      color: #1B4332;
      font-weight: 700;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 999px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 26px;
      letter-spacing: -0.5px;
      color: #1B4332;
    }
    p {
      color: #495057;
      line-height: 1.5;
      font-size: 15px;
      margin: 0 0 24px;
    }
    .btn {
      display: inline-block;
      background: #1B4332;
      color: #FFFDF8;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 16px;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Tutor profile</div>
    <h1>${escapeHtml(tutor.displayName)}</h1>
    <p>${description}</p>
    <a class="btn" href="${profileUrl}">View Profile on Juniper</a>
  </div>
</body>
</html>`;
}

export function generateTutorOgSvg(tutor: TutorOgData): string {
  const subjects = tutor.subjects.slice(0, 3).join('  ·  ') || 'University Courses';
  const rate = tutor.hourlyRateCents > 0 ? `$${Math.round(tutor.hourlyRateCents / 100)} / hr` : 'Rate on profile';
  const name = escapeHtml(tutor.displayName);
  const headline = escapeHtml(tutor.headline || 'Tutoring profile on Juniper');

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0B231B"/>
  
  <!-- Subtle circular accents -->
  <circle cx="1100" cy="100" r="300" stroke="#1B4D3E" stroke-width="2" opacity="0.4"/>
  <circle cx="100" cy="550" r="220" stroke="#1B4D3E" stroke-width="2" opacity="0.3"/>
  <circle cx="1100" cy="100" r="180" stroke="#1B4D3E" stroke-width="1.5" opacity="0.3"/>
  
  <!-- Juniper Leaf Brandmark -->
  <g transform="translate(100, 90)">
    <rect width="52" height="52" rx="16" fill="#1B4332" />
    <path d="M16 36C16 25 25 16 36 16C36 27 27 36 16 36Z" stroke="#A7F3D0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 36L28 24" stroke="#A7F3D0" stroke-width="3" stroke-linecap="round"/>
    <text x="68" y="36" font-family="Inter, -apple-system, sans-serif" font-size="28" font-weight="800" fill="#FFFDF8" letter-spacing="-0.5">juniper</text>
  </g>

  <!-- Profile badge -->
  <g transform="translate(100, 210)">
    <rect width="210" height="38" rx="19" fill="#1B4332" />
    <text x="20" y="24" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#A7F3D0" letter-spacing="0.8">TUTOR PROFILE</text>
  </g>

  <!-- Tutor Name -->
  <text x="100" y="310" font-family="Inter, -apple-system, sans-serif" font-size="64" font-weight="800" fill="#FFFDF8" letter-spacing="-1.5">${name}</text>
  
  <!-- Headline / University focus -->
  <text x="100" y="365" font-family="Inter, -apple-system, sans-serif" font-size="26" font-weight="500" fill="#CBD5E1">${headline}</text>
  
  <!-- Subjects pill -->
  <g transform="translate(100, 420)">
    <rect width="680" height="54" rx="16" fill="rgba(255, 255, 255, 0.08)" stroke="#1B4D3E" stroke-width="1.5"/>
    <text x="24" y="34" font-family="Inter, -apple-system, sans-serif" font-size="20" font-weight="600" fill="#E1EBDD">📚  ${escapeHtml(subjects)}</text>
  </g>

  <!-- Proposed rate -->
  <g transform="translate(100, 510)">
    <text x="0" y="42" font-family="Inter, -apple-system, sans-serif" font-size="36" font-weight="800" fill="#34D399">${rate}</text>
    <text x="220" y="40" font-family="Inter, -apple-system, sans-serif" font-size="18" font-weight="500" fill="#94A3B8">·  Proposed rate · Payment arranged directly</text>
  </g>
</svg>`;
}
