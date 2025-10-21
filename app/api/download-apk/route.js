import { NextResponse } from 'next/server';

export async function GET() {
  // Redirect to your Google Drive direct download link
  const downloadUrl = 'https://drive.google.com/uc?export=download&id=1yvqZJtG_fQJU8_Nm4gXOOgOKXlXRI1YA';
  
  return NextResponse.redirect(downloadUrl, 302);
}
