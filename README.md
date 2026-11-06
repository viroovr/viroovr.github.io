# viroovr.github.io

서현원의 포트폴리오 · 기술 블로그. Jekyll + 자체 테마(프레임워크 없음), GitHub Actions 로 `gh-pages` 에 배포.

- 글: `_posts/YYYY-MM-DD-slug.md` / 프로젝트: `_projects/N_project.md`
- 홈 소개·경력·기술: `_data/profile.yml`
- 관리 페이지: `/admin` (GitHub fine-grained 토큰으로 로그인)
- 스타일: `assets/css/style.css` 한 파일

로컬 실행:

```bash
docker run --rm -p 8080:8080 -v "$PWD":/srv/jekyll -w /srv/jekyll ruby:3.3 \
  bash -c "bundle install && bundle exec jekyll serve --host 0.0.0.0 --port 8080"
```
