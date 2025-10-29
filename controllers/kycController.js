const { getSignedImageUrl } = require("../middleware/uploadToS3");
const KYC = require("../models/KycLogs");
const User = require("../models/User");
const errorResponse = require("../utils/errorResponse");
const { logUserActivity } = require("../utils/activityLogger");

exports.submitkyc = async (req, res) => {
  try {
    const userId = req.user?.id;
    const docFiles = req.files?.docPhoto || [];
    const docTypes = Array.isArray(req.body.docType)
      ? req.body.docType
      : req.body.docType
        ? [req.body.docType]
        : [];

    const docPhotos = Array.isArray(req.body.docPhoto)
      ? req.body.docPhoto
      : req.body.docPhoto
        ? [req.body.docPhoto]
        : [];

    const docs = docTypes.map((type, index) => ({
      docType: type,
      docPhoto: docPhotos[index] || null,
    }));
   const licenceFile = req.body?.licenceFile;
    if (!req.body.email) {
      return res
        .status(500)
        .json({ success: false, message: "Please complete your profile" });
    }

    const kycData = {
      ...req.body,
      userId,
      docPhoto: docs,
      licenceFile,
    };

    const newKYC = new KYC(kycData);
    await newKYC.save();

    const user = await User.findById(userId);
    if (req.body.licenceType === "learner") {
      if (!user.roles.includes("learner")) {
        user.roles.push("learner");
      }
    } else if (req.body.licenceType === "driving") {
      if (!user.roles.includes("trainer")) {
        user.roles.push("trainer");
      }
    }
    await user.save();

    await logUserActivity({
      userId,
      activityType: "KYC_SUBMITTED",
      metadata: {
        action: "KYC_SUBMITTED",
        licenceType: req.body.licenceType,
        docCount: docs.length,
      },
      req,
    });

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "KYC submitted successfully",
      data: newKYC,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.getKYC = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User not authenticated" });
    }

    const kyc = await KYC.findOne({ userId });
    if (!kyc) {
      return res
        .status(404)
        .json({ success: false, message: "KYC not found" });
    }

    const kycData = kyc.toObject();

    if (Array.isArray(kycData.docPhoto)) {
      kycData.docPhoto = await Promise.all(
        kycData.docPhoto.map(async (doc) => {
          const signedUrl = await getSignedImageUrl(doc.docPhoto);
          return {
            ...doc,
            docPhoto: signedUrl,
          };
        })
      );
    }

    if (kycData.licenceFile) {
      kycData.licenceFile = await getSignedImageUrl(kycData.licenceFile);
    }

    await logUserActivity({
      userId,
      activityType: "KYC_VIEWED",
      metadata: { action: "KYC_VIEWED" },
      req,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "KYC fetched successfully",
      data: kycData,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

exports.updateKYC = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User not authenticated" });
    }

    const updateData = { ...req.body };
    if (req.files?.docPhoto) updateData.docPhoto = req.files.docPhoto[0].path;
    if (req.files?.licenceFile) updateData.licenceFile = req.files.licenceFile[0].path;

    let updatedKYC;

    if (req.method === "PUT") {
      const requiredFields = ["docType", "docPhoto", "address", "dob"];
      for (let field of requiredFields) {
        if (!updateData[field]) {
          return res
            .status(400)
            .json({
              success: false,
              message: `${field} is required for full KYC update`,
            });
        }
      }

      updatedKYC = await KYC.findOneAndUpdate({ userId }, updateData, {
        new: true,
        runValidators: true,
      });
    } else if (req.method === "PATCH") {
      updatedKYC = await KYC.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );
    } else {
      return res
        .status(405)
        .json({ success: false, message: "Method not allowed" });
    }

    await logUserActivity({
      userId,
      activityType: "KYC_UPDATED",
      metadata: {
        action: "KYC_UPDATED",
        updatedFields: Object.keys(updateData),
        updateType: req.method,
      },
      req,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "KYC updated successfully",
      data: updatedKYC,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};
