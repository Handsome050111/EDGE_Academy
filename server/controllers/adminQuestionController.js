const mongoose = require('mongoose');
const Question = require('../models/Question');
const Module = require('../models/Module');
const { logAudit } = require('../utils/audit');

const CONCEPT_TAG_REGEX = /^[a-z0-9_]+$/;
const VALID_CORRECT_OPTIONS = ['A', 'B', 'C', 'D'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

// @desc    Create a single MCQ question
// @route   POST /api/v1/admin/modules/:id/questions
// @access  Private/Admin/SuperAdmin
const createQuestion = async (req, res) => {
  try {
    const moduleId = req.params.id;

    // Verify parent module exists
    const parentModule = await Module.findById(moduleId);
    if (!parentModule) {
      return res.status(404).json({ message: 'Parent module not found' });
    }

    const {
      question_text,
      questionText,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      concept_tag,
      difficulty,
    } = req.body;

    const qText = (question_text || questionText || '').trim();
    if (!qText) {
      return res.status(400).json({ message: 'question_text is required' });
    }

    if (!option_a || !option_b || !option_c || !option_d) {
      return res.status(400).json({ message: 'option_a, option_b, option_c, and option_d are required' });
    }

    const formattedCorrectOption = String(correct_option || '').toUpperCase().trim();
    if (!VALID_CORRECT_OPTIONS.includes(formattedCorrectOption)) {
      return res.status(400).json({ message: "correct_option must be 'A', 'B', 'C', or 'D'" });
    }

    const formattedDifficulty = String(difficulty || 'medium').toLowerCase().trim();
    if (!VALID_DIFFICULTIES.includes(formattedDifficulty)) {
      return res.status(400).json({ message: "difficulty must be 'easy', 'medium', or 'hard'" });
    }

    const formattedConceptTag = String(concept_tag || '').toLowerCase().trim();
    if (!formattedConceptTag || !CONCEPT_TAG_REGEX.test(formattedConceptTag)) {
      return res.status(400).json({
        message: 'concept_tag is required and must contain only lowercase letters, numbers, and underscores',
      });
    }

    const newQuestion = await Question.create({
      moduleId: parentModule._id,
      questionText: qText,
      option_a: option_a.trim(),
      option_b: option_b.trim(),
      option_c: option_c.trim(),
      option_d: option_d.trim(),
      correct_option: formattedCorrectOption,
      explanation: explanation ? explanation.trim() : '',
      concept_tag: formattedConceptTag,
      difficulty: formattedDifficulty,
      version: 1,
      is_active: true,
    });

    await logAudit({
      req,
      action: 'CREATE_QUESTION',
      resourceType: 'Question',
      resourceId: newQuestion._id,
      outcome: 'success',
      description: `Created single MCQ question for module ${moduleId}`,
      metadata: { moduleId, concept_tag: formattedConceptTag, version: 1 },
    });

    return res.status(201).json(newQuestion);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update question with versioning (creates new version, deactivates old)
// @route   PUT /api/v1/admin/questions/:id
// @access  Private/Admin/SuperAdmin
const updateQuestionWithVersioning = async (req, res) => {
  try {
    const questionId = req.params.id;
    const existingQuestion = await Question.findById(questionId);

    if (!existingQuestion || !existingQuestion.is_active || existingQuestion.deleted_at) {
      return res.status(404).json({ message: 'Active question not found' });
    }

    const {
      question_text,
      questionText,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      concept_tag,
      difficulty,
    } = req.body;

    const qText = question_text !== undefined ? String(question_text).trim() : (questionText !== undefined ? String(questionText).trim() : existingQuestion.questionText);
    const optA = option_a !== undefined ? String(option_a).trim() : existingQuestion.option_a;
    const optB = option_b !== undefined ? String(option_b).trim() : existingQuestion.option_b;
    const optC = option_c !== undefined ? String(option_c).trim() : existingQuestion.option_c;
    const optD = option_d !== undefined ? String(option_d).trim() : existingQuestion.option_d;

    let formattedCorrectOption = existingQuestion.correct_option;
    if (correct_option !== undefined) {
      formattedCorrectOption = String(correct_option).toUpperCase().trim();
      if (!VALID_CORRECT_OPTIONS.includes(formattedCorrectOption)) {
        return res.status(400).json({ message: "correct_option must be 'A', 'B', 'C', or 'D'" });
      }
    }

    let formattedDifficulty = existingQuestion.difficulty;
    if (difficulty !== undefined) {
      formattedDifficulty = String(difficulty).toLowerCase().trim();
      if (!VALID_DIFFICULTIES.includes(formattedDifficulty)) {
        return res.status(400).json({ message: "difficulty must be 'easy', 'medium', or 'hard'" });
      }
    }

    let formattedConceptTag = existingQuestion.concept_tag;
    if (concept_tag !== undefined) {
      formattedConceptTag = String(concept_tag).toLowerCase().trim();
      if (!formattedConceptTag || !CONCEPT_TAG_REGEX.test(formattedConceptTag)) {
        return res.status(400).json({
          message: 'concept_tag must contain only lowercase letters, numbers, and underscores',
        });
      }
    }

    const exp = explanation !== undefined ? String(explanation).trim() : existingQuestion.explanation;

    // Deactivate existing question
    existingQuestion.is_active = false;
    await existingQuestion.save();

    // Create new version
    const newVersionNumber = (existingQuestion.version || 1) + 1;
    const newQuestion = await Question.create({
      moduleId: existingQuestion.moduleId,
      questionText: qText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: formattedCorrectOption,
      explanation: exp,
      concept_tag: formattedConceptTag,
      difficulty: formattedDifficulty,
      version: newVersionNumber,
      is_active: true,
    });

    await logAudit({
      req,
      action: 'UPDATE_QUESTION_VERSION',
      resourceType: 'Question',
      resourceId: newQuestion._id,
      outcome: 'success',
      description: `Updated question to version ${newVersionNumber} (deactivated old version ${existingQuestion._id})`,
      metadata: { previousQuestionId: existingQuestion._id, newQuestionId: newQuestion._id, version: newVersionNumber },
    });

    return res.json(newQuestion);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Soft delete a question
// @route   DELETE /api/v1/admin/questions/:id
// @access  Private/Admin/SuperAdmin
const softDeleteQuestion = async (req, res) => {
  try {
    const questionId = req.params.id;
    const question = await Question.findById(questionId);

    if (!question || question.deleted_at) {
      return res.status(404).json({ message: 'Question not found or already deleted' });
    }

    question.is_active = false;
    question.deleted_at = new Date();
    await question.save();

    await logAudit({
      req,
      action: 'DELETE_QUESTION',
      resourceType: 'Question',
      resourceId: question._id,
      outcome: 'success',
      description: `Soft deleted question ${question._id}`,
      metadata: { deleted_at: question.deleted_at },
    });

    return res.json({ message: 'Question soft-deleted successfully', questionId: question._id });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Robust CSV Line Parser supporting quoted values and line breaks
const parseCSVString = (csvString) => {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];
    const nextChar = csvString[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
};

// @desc    Bulk import MCQ questions from CSV with row-by-row validation
// @route   POST /api/v1/admin/questions/import
// @access  Private/Admin/SuperAdmin
const importQuestionsCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const globalModuleId = req.body.moduleId || req.body.module_id || req.query.moduleId || req.query.module_id;
    const csvContent = req.file.buffer ? req.file.buffer.toString('utf-8') : '';

    if (!csvContent.trim()) {
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    const rows = parseCSVString(csvContent);
    if (rows.length < 2) {
      return res.status(400).json({ message: 'CSV file must contain a header row and at least one data row' });
    }

    const header = rows[0].map((h) => h.toLowerCase().trim());

    // Header alias mapping for flexible column name support
    const HEADER_ALIASES = {
      question_text: ['question_text', 'questiontext', 'question text', 'question'],
      option_a: ['option_a', 'optiona', 'option a'],
      option_b: ['option_b', 'optionb', 'option b'],
      option_c: ['option_c', 'optionc', 'option c'],
      option_d: ['option_d', 'optiond', 'option d'],
      correct_option: ['correct_option', 'correctoption', 'correct option', 'answer'],
      module_id: ['module_id', 'moduleid'],
      difficulty: ['difficulty'],
      concept_tag: ['concept_tag', 'concepttag', 'concept tag'],
      explanation: ['explanation'],
    };

    // Build a map from raw lowercased header → canonical key
    const headerMap = {};
    for (const rawHeader of header) {
      for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.includes(rawHeader)) {
          headerMap[rawHeader] = canonical;
          break;
        }
      }
      // If no alias matched, keep the raw header as-is
      if (!headerMap[rawHeader]) {
        headerMap[rawHeader] = rawHeader;
      }
    }

    const dataRows = rows.slice(1);

    const validQuestions = [];
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2; // 1-indexed line number (header is row 1)
      const rowValues = dataRows[i];

      // Build row data using canonical keys
      const rowData = {};
      header.forEach((rawKey, index) => {
        const canonicalKey = headerMap[rawKey] || rawKey;
        const rawValue = rowValues[index] || '';
        // Trim whitespace and surrounding quotes
        rowData[canonicalKey] = rawValue.replace(/^["']+|["']+$/g, '').trim();
      });

      const rowModuleId = rowData.module_id || globalModuleId;
      const questionText = rowData.question_text;
      const optionA = rowData.option_a;
      const optionB = rowData.option_b;
      const optionC = rowData.option_c;
      const optionD = rowData.option_d;
      const correctOption = String(rowData.correct_option || '').toUpperCase().trim();
      const difficulty = String(rowData.difficulty || 'medium').toLowerCase().trim();
      const conceptTag = String(rowData.concept_tag || '').toLowerCase().trim();
      const explanation = rowData.explanation || '';

      // Validate row
      if (!rowModuleId || !mongoose.Types.ObjectId.isValid(rowModuleId)) {
        errors.push({ row: rowNum, error: `Invalid or missing module_id: '${rowModuleId}'` });
        continue;
      }

      if (!questionText) {
        errors.push({ row: rowNum, error: 'Missing required field: question_text' });
        continue;
      }

      if (!optionA || !optionB || !optionC || !optionD) {
        errors.push({ row: rowNum, error: 'Missing one or more required options (option_a, option_b, option_c, option_d)' });
        continue;
      }

      if (!VALID_CORRECT_OPTIONS.includes(correctOption)) {
        errors.push({ row: rowNum, error: `Invalid correct_option '${rowData.correct_option}'. Expected A, B, C, or D.` });
        continue;
      }

      if (!VALID_DIFFICULTIES.includes(difficulty)) {
        errors.push({ row: rowNum, error: `Invalid difficulty '${rowData.difficulty}'. Expected easy, medium, or hard.` });
        continue;
      }

      if (!conceptTag || !CONCEPT_TAG_REGEX.test(conceptTag)) {
        errors.push({ row: rowNum, error: `Invalid concept_tag '${rowData.concept_tag}'. Must be lowercase alphanumeric with underscores.` });
        continue;
      }

      validQuestions.push({
        moduleId: rowModuleId,
        questionText: questionText.trim(),
        option_a: optionA.trim(),
        option_b: optionB.trim(),
        option_c: optionC.trim(),
        option_d: optionD.trim(),
        correct_option: correctOption,
        explanation: explanation.trim(),
        concept_tag: conceptTag,
        difficulty,
        version: 1,
        is_active: true,
      });
    }

    if (validQuestions.length > 0) {
      await Question.insertMany(validQuestions);
    }

    const summary = {
      successCount: validQuestions.length,
      failedCount: errors.length,
      errors,
    };

    await logAudit({
      req,
      action: 'IMPORT_QUESTIONS_CSV',
      resourceType: 'Question',
      outcome: errors.length === 0 ? 'success' : (validQuestions.length > 0 ? 'success' : 'failure'),
      description: `CSV Import completed: ${validQuestions.length} inserted, ${errors.length} failed`,
      metadata: summary,
    });

    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all questions for a module (Admin CMS view)
// @route   GET /api/v1/admin/modules/:id/questions
// @access  Private/Admin/SuperAdmin
const getModuleQuestionsAdmin = async (req, res) => {
  try {
    const moduleId = req.params.id;
    const questions = await Question.find({
      $or: [{ module_id: moduleId }, { moduleId: moduleId }],
      deleted_at: null,
    }).sort({ created_at: -1, createdAt: -1 });

    return res.json(questions);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createQuestion,
  updateQuestionWithVersioning,
  softDeleteQuestion,
  importQuestionsCSV,
  getModuleQuestionsAdmin,
};

