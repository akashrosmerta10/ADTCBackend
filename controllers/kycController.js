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
   const safeJSON = (field) => {
      try {
        return field ? JSON.parse(field) : undefined;
      } catch {
        return undefined;
      }
    };

    const address = safeJSON(req.body.address);
    const currentAddress = safeJSON(req.body.currentAddress);
    const education = safeJSON(req.body.education);
  
let licenceType = req.body.licenceType;

if (!req.body.hasLicence || req.body.hasLicence === "no") {
  licenceType = null;
}

if (req.body.hasLicence === "yes" && !licenceType) {
  return res.status(400).json({
    success: false,
    message: "Licence type is required",
  });
}

if (
  licenceType &&
  !["learner", "driving"].includes(licenceType)
) {
  return res.status(400).json({
    success: false,
    message: "Invalid licence type",
  });
}


    const kycData = {
      userId,
       fatherOrHusbandName: req.body.fatherOrHusbandName,
      gender: req.body.gender,
      dob: req.body.dob,
       hasLicence: req.body.hasLicence === "true",
      licenceType: req.body.licenceType,
      email: req.body.email,
       address,
      currentAddress,
      education,
      docPhoto: docs,
      licenceFile,
    };
 
    const newKYC = new KYC(kycData);
     await newKYC.save();

    const user = await User.findById(userId);
    if (req.body.licenceType === "learner") {
      if (!user.roles.includes("Learner")) {
        user.roles.push("Learner");
      }
    } else if (req.body.licenceType === "driving") {
      if (!user.roles.includes("Trainer")) {
        user.roles.push("Trainer");
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
      return res.status(400).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const updateData = {};

    for (const key in req.body) {
      if (req.body[key] !== "" && req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    if (req.files?.docPhoto?.length > 0) {
      updateData.docPhoto = req.files.docPhoto[0].path;
    }

    if (req.files?.licenceFile?.length > 0) {
      updateData.licenceFile = req.files.licenceFile[0].path;
    }
    const nestedKeys = ["address", "currentAddress", "education"];

    nestedKeys.forEach((field) => {
      if (req.body[field]) {
        try {
          updateData[field] = JSON.parse(req.body[field]);
        } catch (e) {
          updateData[field] = req.body[field];
        }
      }
    });


    const updatedKYC = await KYC.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedKYC) {
      return res.status(404).json({
        success: false,
        message: "No KYC record found for this user",
      });
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
