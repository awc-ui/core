<template>
  <main class="page">
    <h1 class="page-headline">Checkpoint quiz</h1>
    <p class="page-sub">
      {{ quiz.course }} · {{ quiz.title }}. Answer each question to unlock the
      next step — your score lands on the progress page.
    </p>

    <div class="quiz-shell" v-if="!completed">
      <md-stepper
        orientation="horizontal"
        mode="linear"
        label="Quiz progress"
        :next-disabled="!currentAnswered"
        finish-label="See results"
        @mdStepChange="onStepChange"
        @mdComplete="onComplete"
      >
        <md-step
          v-for="(q, qi) in quiz.questions"
          :key="q.id"
          :label="`Question ${qi + 1}`"
          :description="answers[q.id] !== undefined ? 'Answered' : ''"
        >
          <div class="quiz-question" role="radiogroup" :aria-label="`Question ${qi + 1}: ${q.prompt}`">
            <p class="quiz-question__prompt">{{ q.prompt }}</p>
            <label
              v-for="(option, oi) in q.options"
              :key="option"
              class="quiz-option"
            >
              <md-radio
                :name="q.id"
                :value="String(oi)"
                @mdChange="setAnswer(q.id, oi)"
              ></md-radio>
              <span>{{ option }}</span>
            </label>
          </div>
        </md-step>
      </md-stepper>
    </div>

    <md-card v-else variant="elevated" class="quiz-results">
      <p class="quiz-results__score">{{ score }} / {{ quiz.questions.length }}</p>
      <p class="quiz-results__sub">
        {{ scoreMessage }}
      </p>
      <md-meter
        :value="score"
        :max="quiz.questions.length"
        :color="score === quiz.questions.length ? 'success' : score >= quiz.questions.length / 2 ? 'primary' : 'warning'"
        label="Quiz score"
        :value-text="`${score} of ${quiz.questions.length} correct`"
      ></md-meter>
      <md-divider></md-divider>
      <ul class="quiz-review">
        <li v-for="(q, qi) in quiz.questions" :key="q.id">
          <span
            class="verdict"
            :class="answers[q.id] === q.correct ? 'correct' : 'incorrect'"
          >
            Question {{ qi + 1 }} — {{ answers[q.id] === q.correct ? 'Correct' : 'Incorrect' }}
          </span>
          <span>{{ q.prompt }}</span>
          <span class="explanation">
            <template v-if="answers[q.id] !== q.correct">
              Your answer: “{{ q.options[answers[q.id] ?? 0] }}”. Correct answer:
              “{{ q.options[q.correct] }}”.
            </template>
            {{ q.explanation }}
          </span>
        </li>
      </ul>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <md-button variant="text" href="/progress">Go to my progress</md-button>
        <md-button variant="filled" icon="replay" @mdClick="retake">Retake quiz</md-button>
      </div>
    </md-card>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { quiz } from '~/data/courses';

useHead({ title: 'Checkpoint quiz — Tessellate Academy' });

const answers = ref<Record<string, number>>({});
const activeStep = ref(0);
const completed = ref(false);

const currentAnswered = computed(() => {
  const q = quiz.questions[activeStep.value];
  return q ? answers.value[q.id] !== undefined : false;
});

function setAnswer(id: string, optionIndex: number) {
  answers.value = { ...answers.value, [id]: optionIndex };
}

function onStepChange(e: { detail: { index: number } }) {
  activeStep.value = e.detail.index;
}

function onComplete() {
  completed.value = true;
}

const score = computed(
  () => quiz.questions.filter((q) => answers.value[q.id] === q.correct).length,
);

const scoreMessage = computed(() => {
  const total = quiz.questions.length;
  if (score.value === total) return 'Perfect score — the systems module clearly stuck.';
  if (score.value >= total / 2) return 'Solid pass. Skim the explanations below for the ones that got away.';
  return 'Below the pass line — revisit Module 3 and try again when ready.';
});

function retake() {
  answers.value = {};
  activeStep.value = 0;
  completed.value = false;
}
</script>
