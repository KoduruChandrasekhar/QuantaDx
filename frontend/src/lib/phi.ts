/** Column names that look like protected health information (PHI). */
export const PHI_PATTERN = /(^|_|\b)(name|first.?name|last.?name|phone|mobile|email|e-mail|aadhaar|aadhar|pan|address|dob|birth|mrn|ssn|passport)(\b|_|$)/i;
