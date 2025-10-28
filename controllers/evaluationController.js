const EvaluationTemplate = require('../models/EvaluationTemplate');
const Evaluation = require('../models/Evaluation');
const TrainingSession = require('../models/TrainingSession');
const Booking = require('../models/Booking');
const AttendanceSheet = require('../models/Attendance');
const errorResponse = require('../utils/errorResponse');

const requireRoleLocal = (req, roles) => Array.isArray(req.user?.roles) && roles.some(r => req.user.roles.includes(r));

exports.getTemplate = async (req, res) => {
    try {
        if (!requireRoleLocal(req, ['Trainer'])) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: 'Trainer role required',
                data: {},
            });
        }

        const { testType, trainingMode } = req.query;
        if (!testType || !trainingMode) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: 'testType and trainingMode are required',
                data: {},
            });
        }

        const tpl = await EvaluationTemplate.findOne({
            active: true,
            $or: [
                { testType, trainingMode },
                { 'key.testType': testType, 'key.trainingMode': trainingMode },
            ],
        })
            .sort({ version: -1, updatedAt: -1, _id: -1 })
            .lean();

        if (!tpl) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: 'Template not found',
                data: {},
            });
        }

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: 'Evaluation template fetched successfully',
            data: tpl,
        });
    } catch (err) {
        return errorResponse(res, err);
    }
};

exports.saveEvaluation = async (req, res) => {
    try {
        if (!requireRoleLocal(req, ['Trainer'])) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: 'Trainer role required',
                data: {},
            });
        }
        const { sessionId, traineeId, criteriaScores, remarks, feedbackSummary, recommendations, environment } = req.body;
        if (!sessionId || !traineeId || !Array.isArray(criteriaScores)) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: 'sessionId, traineeId, criteriaScores are required',
                data: {},
            });
        }

        const session = await TrainingSession.findOne({
            _id: sessionId,
            trainerId: req.user.id,
        }).lean();

        if (!session) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: 'Session not found',
                data: {},
            });
        }


        const sheet = await AttendanceSheet.findOne({ sessionId }).lean();
        if (!sheet) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: 'Attendance sheet not opened',
                data: {},
            });
        }

        const rec = sheet.records?.find(
            r => String(r.traineeId) === String(traineeId)
        );
        if (!rec || !['present', 'late', 'excused'].includes(rec.status)) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: 'Trainee not marked attended',
                data: {},
            });
        }

        const type = session.topic?.testType || session.trainingType;
        const mode = session.trainingMode || session.mode;
        const template = await EvaluationTemplate
            .findOne({ testType: type, trainingMode: mode, active: true })
            .sort({ version: -1, updatedAt: -1, _id: -1 })
            .lean();

        if (!template) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: 'No evaluation template for this session type/mode',
                data: {},
            });
        }

        const tMap = new Map(template.criteria.map(c => [c.name, c]));
        const normalized = criteriaScores.map(c => {
            const base = tMap.get(c.name) || {};
            const weight = Number(base.weight ?? c.weight ?? 0);
            const max = Number(base.max ?? c.max ?? 1);
            const earned = Math.max(
                0,
                Math.min(max, Number(c.earned ?? c.score ?? 0))
            );
            const note = c.note || '';
            return { name: c.name, weight, max, earned, note };
        });

        const totalPct = normalized.reduce((sum, c) => {
            const part =
                c.max > 0 ? (c.earned / c.max) * (c.weight * 100) : 0;
            return sum + part;
        }, 0);

        const percent = Math.round(Math.max(0, Math.min(100, totalPct)));
        let grade = 'F';
        const bands = [...template.gradeBands].sort(
            (a, b) => a.minPercent - b.minPercent
        );
        for (const b of bands) {
            if (percent >= b.minPercent) grade = b.grade;
        }

        const payload = {
            sessionId,
            trainerId: req.user.id,
            traineeId,
            testType: type,
            trainingMode: mode,
            templateVersion: template.version ?? 1,
            criteriaScores: normalized,
            overall: { percent, grade, remarks: remarks || '' },
            feedback: {
                summary: feedbackSummary || '',
                recommendations: recommendations || [],
            },
            environmentSummary: environment || {},
            status: 'completed',
            evaluatedAt: new Date(),
        };

        const evalDoc = await Evaluation.findOneAndUpdate(
            { sessionId, traineeId },
            { $set: payload },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return res.status(201).json({
            success: true,
            statusCode: 201,
            message: 'Evaluation saved successfully',
            data: evalDoc,
        });
    } catch (err) {
        return errorResponse(res, err);
    }
};

exports.listPending = async (req, res) => {
    try {
        if (!requireRoleLocal(req, ['Trainer'])) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: 'Trainer role required',
                data: {},
            });
        }

        const sessions = await TrainingSession.find({
            trainerId: req.user.id,
            status: 'completed',
        }).select('_id date topic mode');

        const sessionIds = sessions.map(s => s._id);
        if (!sessionIds.length) {
            return res.status(200).json({
                success: true,
                statusCode: 200,
                message: 'No pending evaluations',
                data: [],
            });
        }

        const bookingsBySession = await Booking.aggregate([
            {
                $match: {
                    sessionId: { $in: sessionIds },
                    status: { $in: ['attended', 'missed'] },
                },
            },
            {
                $group: {
                    _id: '$sessionId',
                    trainees: { $addToSet: '$traineeId' },
                },
            },
        ]);

        const evalsBySession = await Evaluation.aggregate([
            { $match: { sessionId: { $in: sessionIds } } },
            {
                $group: {
                    _id: '$sessionId',
                    graded: { $addToSet: '$traineeId' },
                },
            },
        ]);

        const gradedMap = new Map(
            evalsBySession.map(e => [
                String(e._id),
                new Set(e.graded.map(x => String(x))),
            ])
        );

        const pending = [];
        for (const b of bookingsBySession) {
            const graded = gradedMap.get(String(b._id)) || new Set();
            const todo = b.trainees.filter(t => !graded.has(String(t)));
            if (todo.length) {
                const sess = sessions.find(
                    s => String(s._id) === String(b._id)
                );
                pending.push({ session: sess, pendingTrainees: todo });
            }
        }

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: 'Pending evaluations fetched successfully',
            data: pending,
        });
    } catch (err) {
        return errorResponse(res, err);
    }
};

exports.listResults = async (req, res) => {
    try {
        if (!requireRoleLocal(req, ['Trainer'])) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: 'Trainer role required',
                data: {},
            });
        }

        const { from, to, mode, testType, page = 1, pageSize = 10 } = req.query;
        const q = { trainerId: req.user.id };

        if (from) q.evaluatedAt = { ...(q.evaluatedAt || {}), $gte: new Date(from) };
        if (to) q.evaluatedAt = { ...(q.evaluatedAt || {}), $lte: new Date(to) };
        if (mode) q.trainingMode = mode;
        if (testType) q.testType = testType;

        const skip = (Number(page) - 1) * Number(pageSize);
        const [items, total] = await Promise.all([
            Evaluation.find(q)
                .sort({ evaluatedAt: -1 })
                .skip(skip)
                .limit(Number(pageSize)),
            Evaluation.countDocuments(q),
        ]);

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: 'Evaluation results fetched successfully',
            data: {
                items,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
            },
        });
    } catch (err) {
        return errorResponse(res, err);
    }
};
