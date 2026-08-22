<template>
  <main class="page">
    <h1 class="page-headline">My progress</h1>
    <p class="page-sub">
      Welcome back, Noa. Four enrolled courses, one finished — the Systems quiz
      pushed your checkpoint average over 85.
    </p>

    <div class="progress-layout">
      <section aria-label="Course progress" style="display: grid; gap: 16px;">
        <h2 class="section-title" style="margin: 0;">Enrolled courses</h2>
        <md-card
          v-for="item in progressItems"
          :key="item.slug"
          variant="outlined"
          class="progress-course"
        >
          <div class="progress-course__head">
            <h3 class="progress-course__title">{{ item.title }}</h3>
            <span class="progress-course__count">{{ item.completedLessons }} / {{ item.totalLessons }} lessons</span>
          </div>
          <md-progress-indicator
            variant="linear"
            :value="item.completedLessons"
            :max="item.totalLessons"
            :label="`${item.title} progress`"
          ></md-progress-indicator>
          <p class="progress-course__last">
            <template v-if="item.completedLessons === item.totalLessons">
              Completed — nice work.
            </template>
            <template v-else>
              Up next after: {{ item.lastLesson }}
            </template>
          </p>
          <div>
            <md-button variant="text" size="sm" :href="appHref(`/courses/${item.slug}`)" trailing-icon="arrow_forward" mirror-icon>
              {{ item.completedLessons === item.totalLessons ? 'Review course' : 'Continue' }}
            </md-button>
          </div>
        </md-card>
      </section>

      <section aria-label="Overall stats" style="display: grid; gap: 16px;">
        <h2 class="section-title" style="margin: 0;">Overall</h2>
        <md-card variant="filled" class="completion-card">
          <md-meter
            variant="circular"
            :value="completedLessons"
            :max="totalLessons"
            size="132"
            thickness="10"
            color="tertiary"
            label="Overall completion"
            show-label
            show-value
          ></md-meter>
          <p>{{ completedLessons }} of {{ totalLessons }} lessons finished across your enrolled courses.</p>
        </md-card>

        <md-card variant="outlined" class="chart-card">
          <md-bar-chart
            ref="chartEl"
            label="Checkpoint quiz scores"
            subtitle="Last 7 quizzes, percent correct"
            legend="none"
            corner-radius="4"
            height="280px"
            axis-ticks
            :loading="chartLoading"
            loading-label="Loading quiz scores"
          ></md-bar-chart>
        </md-card>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { courses, enrollments, quizScores } from '~/data/courses';

useHead({ title: 'My progress — Tessellate Academy' });

const progressItems = computed(() =>
  enrollments.map((e) => ({
    ...e,
    title: courses.find((c) => c.slug === e.slug)?.title ?? e.slug,
  })),
);

const completedLessons = computed(() => enrollments.reduce((n, e) => n + e.completedLessons, 0));
const totalLessons = computed(() => enrollments.reduce((n, e) => n + e.totalLessons, 0));

// Chart data crosses the attribute boundary only as JS properties — feed it
// after the custom element is defined on the client.
const chartEl = ref<any>(null);
const chartLoading = ref(true);

onMounted(async () => {
  await customElements.whenDefined('md-bar-chart');
  const chart = chartEl.value;
  if (!chart) return;
  chart.series = [{ label: 'Score', data: quizScores.scores }];
  chart.xAxis = { data: quizScores.labels };
  chart.yAxis = { min: 0, max: 100 };
  chart.valueFormatter = (v: number | null) => `${v ?? 0}%`;
  chartLoading.value = false;
});
</script>
