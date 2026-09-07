<script lang="ts">
  import { t } from '$lib/showcase';
  import { snackbar, closeSnackbar } from '$lib/snackbar';
</script>

<md-snackbar
  class="app-snackbar"
  open={$snackbar !== null || undefined}
  message={$snackbar ? $t($snackbar.key, $snackbar.params) : ''}
  duration={4000}
  on:mdClose={closeSnackbar}
></md-snackbar>
