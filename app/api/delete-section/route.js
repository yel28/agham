// Server-side API route to delete sections (bypasses client-side rules)
import { db } from '../../lib/firebase.js';
import { doc, deleteDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const { sectionId } = await request.json();
    
    if (!sectionId) {
      return Response.json({ error: 'Section ID is required' }, { status: 400 });
    }
    
    console.log('Server-side section deletion for:', sectionId);
    
    // Delete the section using server-side context
    const sectionRef = doc(db, 'academic', 'sections', 'sections', sectionId);
    await deleteDoc(sectionRef);
    
    console.log('Section deleted successfully via server');
    
    return Response.json({ success: true, message: 'Section deleted successfully' });
    
  } catch (error) {
    console.error('Server-side deletion error:', error);
    return Response.json({ 
      error: 'Failed to delete section', 
      details: error.message 
    }, { status: 500 });
  }
}
