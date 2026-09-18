const { put } = require('@vercel/blob');
const pool = require('../db');

// Vercel needs this to allow raw binary bodies
module.exports.config = {
  api: {
    bodyParser: false
  }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-file-name');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { studentId, documentType } = req.query;
    const fileName = req.headers['x-file-name'] || 'document.pdf';

    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    // Read the raw body into a Buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Empty file body' });
    }

    // Upload to Vercel Blob
    const blob = await put(`students/${studentId}/${Date.now()}-${fileName}`, buffer, {
      access: 'public',
      contentType: req.headers['content-type'] || 'application/octet-stream',
      addRandomSuffix: true
    });

    // Save record to database
    const result = await pool.query(
      'INSERT INTO documents (student_id, file_name, file_url, document_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [studentId, fileName, blob.url, documentType || 'General']
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
};