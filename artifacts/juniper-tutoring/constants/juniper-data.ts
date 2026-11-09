import type { ImageSourcePropType } from 'react-native';

export type Tutor = {
  id: string;
  name: string;
  subject: string;
  subjects: string[];
  hourlyRate: number;
  photo: ImageSourcePropType;
  focus: string;
  approach: string;
  about: string;
  nextSlot: string;
};

export type Subject = {
  name: string;
  icon: string;
  description: string;
};

export type LearningPathId = 'school' | 'university' | 'languages' | 'exams' | 'professional' | 'other';

export const LEARNING_PATHS: Array<{ id: LearningPathId; label: string; description: string; icon: string }> = [
  { id: 'school', label: 'School', description: 'Primary to high school', icon: 'school-outline' },
  { id: 'university', label: 'University & college', description: 'Courses, majors, and degrees', icon: 'library-outline' },
  { id: 'languages', label: 'Languages', description: 'Conversation, fluency, and writing', icon: 'language-outline' },
  { id: 'exams', label: 'Exams & certifications', description: 'Prepare for a specific test', icon: 'ribbon-outline' },
  { id: 'professional', label: 'Professional skills', description: 'Practical and career learning', icon: 'briefcase-outline' },
  { id: 'other', label: 'Something else', description: 'Tell us what you want to learn', icon: 'add-circle-outline' },
];

const LANGUAGE_SUBJECTS = new Set([
  'languages', 'spanish', 'german', 'mandarin chinese', 'japanese', 'korean', 'italian', 'portuguese',
  'turkish', 'russian', 'persian', 'hindi', 'urdu', 'greek', 'swahili', 'english as a second language',
  'sign languages', 'english', 'arabic', 'french',
]);

const PROFESSIONAL_SUBJECTS = new Set([
  'computer science', 'data science', 'information technology', 'art & design', 'writing & research',
  'marketing', 'management', 'accounting', 'finance',
]);

export function getLearningPathForSubject(subjectName: string): LearningPathId {
  const normalized = subjectName.trim().toLowerCase();
  if (LANGUAGE_SUBJECTS.has(normalized)) return 'languages';
  if (normalized === 'other subject') return 'other';
  if (PROFESSIONAL_SUBJECTS.has(normalized)) return 'professional';
  return 'university';
}

export function subjectsForLearningPath(path: LearningPathId, subjects: Subject[]): Subject[] {
  if (path === 'languages') return subjects.filter((item) => LANGUAGE_SUBJECTS.has(item.name.toLowerCase()));
  if (path === 'professional') return subjects.filter((item) => PROFESSIONAL_SUBJECTS.has(item.name.toLowerCase()));
  if (path === 'other') return subjects.filter((item) => item.name === 'Other subject');
  if (path === 'school') {
    const school = new Set(['mathematics', 'physics', 'biology', 'chemistry', 'computer science', 'english', 'arabic', 'french', 'history', 'geography', 'writing & research', 'statistics']);
    return subjects.filter((item) => school.has(item.name.toLowerCase()));
  }
  if (path === 'exams') return subjects.filter((item) => item.name !== 'Other subject');
  return subjects.filter((item) => item.name !== 'Other subject' && !LANGUAGE_SUBJECTS.has(item.name.toLowerCase()));
}

export type ExampleRequest = {
  id: string;
  learner: string;
  subject: string;
  title: string;
  details: string;
  deadline: string;
  budget: number;
  customCourse?: string | null;
  university?: string | null;
  instructionLanguage?: string | null;
};

export const SUBJECTS: Subject[] = [
  { name: 'Mathematics', icon: 'calculator-outline', description: 'Algebra, calculus, statistics, and more' },
  { name: 'Physics', icon: 'planet-outline', description: 'Mechanics, electricity, and more' },
  { name: 'Biology', icon: 'leaf-outline', description: 'Cell biology, genetics, and more' },
  { name: 'Chemistry', icon: 'flask-outline', description: 'Organic, general, and physical chemistry' },
  { name: 'Computer science', icon: 'code-slash-outline', description: 'Programming, algorithms, and systems' },
  { name: 'Engineering', icon: 'construct-outline', description: 'Explore engineering subjects and tools' },
  { name: 'Business', icon: 'briefcase-outline', description: 'Management, marketing, and strategy' },
  { name: 'Accounting', icon: 'calculator-outline', description: 'Financial and managerial accounting' },
  { name: 'Finance', icon: 'cash-outline', description: 'Finance concepts, markets, and analysis' },
  { name: 'Marketing', icon: 'megaphone-outline', description: 'Marketing principles and practice' },
  { name: 'Management', icon: 'briefcase-outline', description: 'Management concepts and organizations' },
  { name: 'Economics', icon: 'trending-up-outline', description: 'Microeconomics, macroeconomics, and more' },
  { name: 'Civil engineering', icon: 'construct-outline', description: 'Civil engineering concepts and problem solving' },
  { name: 'Electrical engineering', icon: 'flash-outline', description: 'Circuits, signals, and electronics' },
  { name: 'Mechanical engineering', icon: 'settings-outline', description: 'Mechanics, thermodynamics, and design' },
  { name: 'Data science', icon: 'analytics-outline', description: 'Data analysis, programming, and statistics' },
  { name: 'Environmental science', icon: 'earth-outline', description: 'Study ecosystems, climate, and environmental systems' },
  { name: 'Agriculture', icon: 'leaf-outline', description: 'Learn agricultural science and practice' },
  { name: 'Information technology', icon: 'desktop-outline', description: 'Study IT systems, networking, and technical skills' },
  { name: 'Nursing', icon: 'medkit-outline', description: 'Review nursing concepts and clinical theory' },
  { name: 'Public health', icon: 'medkit-outline', description: 'Study public health, prevention, and health systems' },
  { name: 'Dentistry', icon: 'medkit-outline', description: 'Review dental science and clinical theory' },
  { name: 'Veterinary medicine', icon: 'medkit-outline', description: 'Study veterinary science and animal health' },
  { name: 'Nutrition', icon: 'nutrition-outline', description: 'Learn nutrition science and dietary concepts' },
  { name: 'Medicine', icon: 'medkit-outline', description: 'Study medical concepts with qualified tutors' },
  { name: 'Pharmacy', icon: 'flask-outline', description: 'Pharmaceutical science and therapeutics' },
  { name: 'Law', icon: 'library-outline', description: 'Study legal concepts and reasoning' },
  { name: 'Psychology', icon: 'people-outline', description: 'Understand psychology concepts and research' },
  { name: 'Sociology', icon: 'people-outline', description: 'Explore society, groups, and institutions' },
  { name: 'Political science', icon: 'globe-outline', description: 'Explore politics, policy, and institutions' },
  { name: 'Education', icon: 'school-outline', description: 'Study teaching and learning' },
  { name: 'Philosophy', icon: 'bulb-outline', description: 'Explore philosophy, argument, and critical thinking' },
  { name: 'Geography', icon: 'earth-outline', description: 'Study places, environments, and spatial systems' },
  { name: 'Anthropology', icon: 'people-outline', description: 'Explore human societies and cultures' },
  { name: 'Media and communications', icon: 'megaphone-outline', description: 'Study media, communication, and journalism' },
  { name: 'Languages', icon: 'language-outline', description: 'Practice a language with a tutor' },
  { name: 'Spanish', icon: 'language-outline', description: 'Practice Spanish through conversation, grammar, and writing' },
  { name: 'German', icon: 'language-outline', description: 'Build German speaking, listening, reading, and writing skills' },
  { name: 'Mandarin Chinese', icon: 'language-outline', description: 'Learn Mandarin pronunciation, characters, and conversation' },
  { name: 'Japanese', icon: 'language-outline', description: 'Practice Japanese language skills and conversation' },
  { name: 'Korean', icon: 'language-outline', description: 'Learn Korean grammar, reading, and conversation' },
  { name: 'Italian', icon: 'language-outline', description: 'Practice Italian through guided conversation and study' },
  { name: 'Portuguese', icon: 'language-outline', description: 'Build Portuguese speaking, listening, reading, and writing skills' },
  { name: 'Turkish', icon: 'language-outline', description: 'Practice Turkish language skills with a tutor' },
  { name: 'Russian', icon: 'language-outline', description: 'Learn Russian grammar, reading, and conversation' },
  { name: 'Persian', icon: 'language-outline', description: 'Practice Persian language skills and conversation' },
  { name: 'Hindi', icon: 'language-outline', description: 'Learn Hindi through conversation, reading, and writing' },
  { name: 'Urdu', icon: 'language-outline', description: 'Practice Urdu language skills with a tutor' },
  { name: 'Greek', icon: 'language-outline', description: 'Build Greek speaking, reading, and writing skills' },
  { name: 'Swahili', icon: 'language-outline', description: 'Practice Swahili through guided learning' },
  { name: 'English as a second language', icon: 'language-outline', description: 'Learn English at your level, from conversation to writing' },
  { name: 'Sign languages', icon: 'hand-left-outline', description: 'Find tutoring for sign language learning' },
  { name: 'English', icon: 'book-outline', description: 'Writing, reading, and language skills' },
  { name: 'Arabic', icon: 'chatbubble-ellipses-outline', description: 'Arabic language, reading, and writing' },
  { name: 'French', icon: 'chatbubble-ellipses-outline', description: 'French language, reading, and writing' },
  { name: 'Statistics', icon: 'stats-chart-outline', description: 'Probability, data analysis, and inference' },
  { name: 'History', icon: 'time-outline', description: 'Explore historical periods and ideas' },
  { name: 'Architecture', icon: 'business-outline', description: 'Architecture concepts, tools, and design' },
  { name: 'Art & Design', icon: 'color-palette-outline', description: 'Develop visual and design skills' },
  { name: 'Writing & research', icon: 'create-outline', description: 'Build writing and research skills' },
  { name: 'Other subject', icon: 'book-outline', description: 'Ask about a subject not listed here' },
];

export const SAMPLE_TUTORS: Tutor[] = [
  {
    id: 'tutor-maya',
    name: 'Maya Khoury',
    subject: 'Mathematics',
    subjects: ['Mathematics', 'Statistics'],
    hourlyRate: 28,
    photo: require('../assets/images/tutor-portrait-1.png'),
    focus: 'Calculus · Differential Equations · Exam Prep',
    approach: 'Fast, rigorous breakdown of proofs with step-by-step derivations',
    about:
      'Applied mathematics tutor who helps learners work through calculus concepts and build confidence with proofs and problem solving.',
    nextSlot: 'Today · 4:30 PM',
  },
  {
    id: 'tutor-adam',
    name: 'Adam Park',
    subject: 'Physics',
    subjects: ['Physics', 'Mathematics'],
    hourlyRate: 32,
    photo: require('../assets/images/tutor-portrait-2.png'),
    focus: 'Mechanics · Thermodynamics · Problem Solving',
    approach: 'Precision free-body diagrams, mathematical proofs, and applied physics',
    about:
      'B.S. in Mechanical Engineering. Hundreds of completed problem sets across statics, dynamics, and quantum mechanics with clean digital walkthroughs.',
    nextSlot: 'Today · 6:00 PM',
  },
  {
    id: 'tutor-leila',
    name: 'Leila Haddad',
    subject: 'Computer science',
    subjects: ['Computer science', 'Mathematics'],
    hourlyRate: 30,
    photo: require('../assets/images/tutor-portrait-3.png'),
    focus: 'Data Structures · Algorithms · C++/Python',
    approach: 'Clean code walkthroughs, runtime complexity analysis, and live debugging',
    about:
      'Computer science tutor who explains algorithms, code structure, and debugging strategies through guided practice.',
    nextSlot: 'Tomorrow · 10:00 AM',
  },
];

export const EXAMPLE_REQUESTS: ExampleRequest[] = [
  {
    id: 'sample-request-derivatives',
    learner: 'Engineering Student',
    subject: 'Mathematics',
    title: 'Differential Equations & Laplace Transform problem set',
    details: 'I understand the basics but need help choosing an approach for Laplace transforms and checking my reasoning.',
    deadline: 'Due in 4 Hours',
    budget: 45,
  },
  {
    id: 'sample-request-essay',
    learner: 'Computer Science Major',
    subject: 'Computer science',
    title: 'Graph Traversal & Dijkstra algorithm implementation in C++',
    details: 'I would like to review graph traversal and understand how Dijkstra’s algorithm works in C++.',
    deadline: 'Due Tomorrow',
    budget: 50,
  },
  {
    id: 'sample-request-physics',
    learner: 'Civil Engineering Student',
    subject: 'Physics',
    title: '3D Truss Equilibrium & Shear-Moment diagrams',
    details: 'I am reviewing truss equilibrium and need a tutor to explain how to set up the force calculations.',
    deadline: 'Tonight (3h)',
    budget: 40,
  },
];
