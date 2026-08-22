<template>
  <main class="page" v-if="course">
    <div class="course-hero">
      <div>
        <span class="course-card__level">{{ course.level }} · {{ course.hours }} hours · {{ lessonCount }} lessons</span>
        <h1 class="page-headline">{{ course.title }}</h1>
        <p class="page-sub">{{ course.tagline }}</p>
        <div class="course-hero__rating">
          <md-rating
            :value="course.rating"
            precision="0.5"
            size="sm"
            readonly
            show-value-label
            :rating-label="`Average rating for ${course.title}`"
          ></md-rating>
          <span>{{ course.ratingCount.toLocaleString('en-US') }} ratings</span>
        </div>
        <div class="course-card__chips" style="margin-block-start: 14px;">
          <md-chip
            v-for="topic in course.topics"
            :key="topic"
            variant="assist"
            appearance="outlined"
            :label="topic"
          ></md-chip>
        </div>
      </div>

      <md-card variant="filled" class="enroll-card">
        <p class="enroll-card__price">${{ course.price }}</p>
        <ul class="enroll-card__facts">
          <li>{{ course.modules.length }} modules, {{ lessonCount }} lessons</li>
          <li>Taught by {{ course.instructor }}</li>
          <li>Checkpoint quizzes included</li>
          <li>Lifetime access</li>
        </ul>
        <md-button
          v-if="!enrolled"
          variant="filled"
          size="md"
          full-width
          icon="school"
          @mdClick="enrolled = true"
        >Enroll now</md-button>
        <template v-else>
          <md-button variant="tonal" size="md" full-width icon="check" soft-disabled>Enrolled</md-button>
          <p class="enrolled-note">You are enrolled — find this course under My progress.</p>
        </template>
      </md-card>
    </div>

    <md-tabs :aria-label="`${course.title} sections`" tab-width="auto">
      <md-tab label="Lessons" icon="menu_book" inline-icon></md-tab>
      <md-tab label="About" icon="info" inline-icon></md-tab>
      <md-tab label="Reviews" icon="reviews" inline-icon :badge="String(course.reviews.length)"></md-tab>
    </md-tabs>

    <md-tab-panels sizing="active" class="tab-region">
      <md-tab-panel>
        <h2 class="section-title">Syllabus</h2>
        <md-accordion variant="outlined" default-expanded="0" heading-level="3">
          <md-accordion-item
            v-for="(mod, i) in course.modules"
            :key="mod.title"
            :headline="`Module ${i + 1} — ${mod.title}`"
            :supporting-text="mod.summary"
            icon="collections_bookmark"
          >
            <ul class="lesson-list">
              <li v-for="lesson in mod.lessons" :key="lesson.title">
                <span>{{ lesson.title }}</span>
                <span class="duration">{{ lesson.duration }}</span>
              </li>
            </ul>
          </md-accordion-item>
        </md-accordion>
      </md-tab-panel>

      <md-tab-panel>
        <h2 class="section-title">About this course</h2>
        <div class="about-copy">
          <p v-for="para in course.about" :key="para">{{ para }}</p>
        </div>
        <h3 style="margin: 20px 0 0; font: var(--md-sys-typescale-title-medium-font);">What you will be able to do</h3>
        <ul class="outcome-list">
          <li v-for="outcome in course.outcomes" :key="outcome">{{ outcome }}</li>
        </ul>
        <div class="instructor-box">
          <span class="name">{{ course.instructor }}</span>
          <span class="role">{{ course.instructorRole }}</span>
        </div>
      </md-tab-panel>

      <md-tab-panel>
        <h2 class="section-title">Learner reviews</h2>
        <div class="review-list">
          <md-card
            v-for="review in course.reviews"
            :key="review.name"
            variant="outlined"
            class="review-card"
          >
            <div class="review-card__head">
              <span class="review-card__name">{{ review.name }}</span>
              <span class="review-card__date">{{ review.date }}</span>
            </div>
            <md-rating
              :value="review.rating"
              precision="0.5"
              size="xs"
              readonly
              :rating-label="`Rating by ${review.name}`"
            ></md-rating>
            <p class="review-card__text">{{ review.text }}</p>
          </md-card>
        </div>
      </md-tab-panel>
    </md-tab-panels>
  </main>

  <main class="page" v-else>
    <h1 class="page-headline">Course not found</h1>
    <p class="page-sub">This course is not in the catalog. It may have been retired.</p>
    <md-button variant="tonal" :href="appHref('/')" icon="arrow_back" mirror-icon style="margin-block-start: 16px;">
      Back to catalog
    </md-button>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getCourse } from '~/data/courses';

const route = useRoute();
const course = getCourse(String(route.params.slug));
const enrolled = ref(false);

const lessonCount = computed(() =>
  course ? course.modules.reduce((n, m) => n + m.lessons.length, 0) : 0,
);

useHead({ title: course ? `${course.title} — Tessellate Academy` : 'Course not found — Tessellate Academy' });
</script>
