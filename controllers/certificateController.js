const Certificate = require('../models/Certificate');

exports.createCertificate = async (req, res) => {
  try {
    const certificate = new Certificate(req.body);
    await certificate.save();
    res.status(201).json(certificate);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getAllCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find();
    res.json(certificates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (certificate == null) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    res.json(certificate);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(certificate);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteCertificate = async (req, res) => {
  try {
    await Certificate.findByIdAndRemove(req.params.id);
    res.json({ message: 'Certificate deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};