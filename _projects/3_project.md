---
layout: page
title: Providing Support for Exchange Students at SKKU, SKKUEXS
description: Capstone Design Project, Sungkyunkwan University
img: assets/img/3_skkuexs.png
importance: 1
category: work
---

1 . Introduction

Exchange programs provide students with valuable opportunities to explore different
cultures, gain new experiences and broaden their knowledge. However,
exchange students often encounter challenges such as cultural differences, language
barriers and social isolation. “SKKUEXS” aims to address these challenges
and create a nurturing environment for exchange students at SKKU. By offering
services like access to learning materials, a community platform and reliable
information, we strive to enhance the exchange student experience and facilitate
a smoother transition into their new academic and cultural surroundings.
Our techniques involve utilizing Django and AWS Lightsail for web development,
SQLite for database management, Figma for web design, KoT5,
GPT-4 for text summarization and WordCloud for visual representation
of university-related keywords. Through these approaches, we aim to provide a
user-friendly and comprehensive support platform.
In the process of implementing our project, we faced challenges in code functionality,
collaboration and code sharing using GitHub. Familiarity with GitHub
was initially limited and communication barriers hindered the generation of creative
ideas and technical solutions during collaborative meetings. However, we overcame these challenges through research, problem-solving and open discussions.
We have described the recent activity and the corresponding code in Notion,
along with relevant photos and organized the tasks to be done. As a
result, we achieved significant progress in improving our coding skills, mastering
GitHub and enhancing communication and collaboration. Empirical evaluations
confirmed improvements in code functionality, efficient code sharing and
more productive teamwork. Despite the initial difficulties, our perseverance and
growth have ultimately strengthened the outcomes of our project.

2 . Background

The exchange student program is a system where students are dispatched to
foreign partner universities with which the SKKU has a student exchange agreement,
for a semester or a year of study. However, for students preparing for their
overseas experience, there is a significant burden, as a considerable number of
students reported independently preparing for the foreign environment.
We conducted a survey using Google Forms to investigate further inconveniences.
Figure 1 shows survey results conducted among Sungkyunkwan University
students revealed that downloading individual study reports was considered
cumbersome by 47.6% of the respondents, while 9.5% found it difficult to have
a comprehensive overview of the information. The result says the process of accessing
individual study reports is cumbersome and time-consuming, as students
need to review and compare information from separate files.
In line with this, as shown Figure 2, 79.5% of the students expressed their
willingness to use a website that offers summarized and organized study reports.
This demonstrates the significant value of a service that summarizes and organizes
the reports.

<div class="row mt-5">
    <div class="col-sm mt-5 mt-md-0">
        {% include figure.html path="assets/img/3_figure1.png"  class="img-fluid rounded z-depth-1" %}
        Figure 1. Inconveniences of study reports
    </div>
    <div class="col-sm mt-5 mt-md-0">
        {% include figure.html path="assets/img/3_figure2.png"  class="img-fluid rounded z-depth-1" %}
        Figure 2. Intention to utilize a website that offers summarized and organized study reports
    </div>
</div>

3 . CoreSkill

One of the key skills in this project involves preprocessing the crawled documents,
which are downloaded using Selenium in various file formats such as
docx, doc, pdf and hwp. Using Python, the desired data is extracted and organized
item by item based on the specific file format and then transformed into a
structured format for conversion to Excel. This process requires integrating the
extracted information and storing it in a database, which involves designing a
suitable database schema, creating tables and establishing connections between
the application and the database.
Second core skill utilized in this project is web development using Django
framework. Django enables efficient server-side processing, handling user authentication,
data storage and routing. It simplifies the development process
by providing pre-built functionalities, such as user management and database
integration.

4 . Frontend

Login On the root page, there are options for login and registration. When
accessing the login page, users can choose to log in using social login options like
Google, Kakao, or Naver, or they can proceed with a regular login using their
username and password. Figure 3 shows the login page.
If users forget their username, they can enter their email address, and if it
matches the database, the username will be sent to the corresponding email.
Similarly, if users forget their password, they can enter their email and username,
and a similar process will be followed to send a password reset email and
allow them to enter a new password.
If users choose to register using social login, the integration with the respective
site’s API is performed, and if the user is not already registered, additional
information like school name and major will be collected before completing the
registration process. If the user is already registered, they will be redirected to
their school page.
If user prefers not to log in and use the site for school search purposes, user
can search for schools as a guest user. Figure 4 shows the guest users’ school
search page. Guest users have access to the school main page and other subdomains,
but they cannot utilize the bulletin board feature.

<div class="row mt-5">
    <div class="col-sm mt-5 mt-md-0">
        {% include figure.html path="assets/img/3_figure3.png"  class="img-fluid rounded z-depth-1" %}
        Figure 3. The login page
    </div>
    <div class="col-sm mt-5 mt-md-0">
        {% include figure.html path="assets/img/3_figure4.png"  class="img-fluid rounded z-depth-1" %}
        Figure 4. Guest Experience Page
    </div>
</div>

School Main The school main page displays the name of the school, the country,
and a visually intuitive satisfaction rating using a 5-star system. Figure 5
shows the main page of specific school with WordCloud. A brief one-line introduction
provides summarized information about the school, and a word cloud
visually represents frequent keywords found in the school’s academic reports.
Additionally, three landmark photos of the school from a Google custom search
engine offer a glimpse of the surroundings for users to preview.
Fig.

School Subpages The school subpages are categorized into three sections:
Preparation, Student Life, and Community. Figure 6 shows the indexing subpages
of school.

<div class="row mt-5">
    <div class="col-sm mt-5 mt-md-0">
        {% include figure.html path="assets/img/3_figure5.png"  class="img-fluid rounded z-depth-1" %}
        Figure 5. The school main page
    </div>
    <div class="col-sm mt-5 mt-md-0">
        {% include figure.html path="assets/img/3_figure6.png"  class="img-fluid rounded z-depth-1" %}
        Figure 6. The school index page
    </div>
</div>

Preparation Under the Preparation section, users can access information related
to visas, dormitories, and other important considerations. Figure 7
shows the specification of visa page. The visa page provides details on visa
types, processing time, and application procedures. The dormitory page offers
information about different types of dormitories, average costs, links to
dormitory websites, and notable features. The other considerations page provides
essential preparation items and valuable tips based on the experiences
of senior students.

the Community The Community section includes a bulletin board feature
that is unique to each school, allowing users to write posts and search for
existing posts. Figure 8 shows that the forum page is intuitive and simplistic
display of posts. Users can write a post by providing a title and content
within 200 characters, with an option to enable comments. Once a post is
created, the title and the first sentence of the post are displayed, along with
the date it was posted. Users can also leave comments on each post. school
life.

<div class="row mt-5">
    <div class="col-sm mt-5 mt-md-0">
        {% include figure.html path="assets/img/3_figure7.png"  class="img-fluid rounded z-depth-1" %}
        Figure 7. The visa page
    </div>
    <div class="col-sm mt-5 mt-md-0">
        {% include figure.html path="assets/img/3_figure8.png"  class="img-fluid rounded z-depth-1" %}
        Figure 8. The forum page
    </div>
</div>

5 . Backend

Django, a Python web framework, was employed for server-side development.
It handles user authentication, routing and business logic implementation. The
backend interacts with the database, utilizing SQLite for data storage and retrieval.
External APIs are integrated to fetch relevant information for the exchange
program and university details. NLP libraries of KoT5 and GPT-4 are
utilized for text summarization and analysis. AWS Lightsail provides the infrastructure
for hosting the backend server, ensuring reliable and scalable performance.
We chose to use AWS server with 1GB RAM, 1 vCPU, and 40GB SSD,
as it offers a lightweight and suitable solution for our initial deployment, despite
its limitations.

6 . Conclusion

The SKKUEXS project addresses the challenges faced by exchange students
studying at Sungkyunkwan University by providing a comprehensive support
system. Our platform offers access to learning materials, a community platform
for connection and mentorship and reliable information. It differentiates itself
from previous works by taking a holistic approach and focusing on the broader
needs of exchange students.
Through the utilization of Django, KoT5 and other relevant technologies,
we have developed a user-friendly web application that enhances the exchange
student experience. Our system enables students to easily navigate through university
information, connect with local alumni and access essential resources.
Although challenges were encountered during the implementation process,
we overcame them through collaboration, research and problem-solving. The
empirical evaluations of our system demonstrate its effectiveness in providing
support and enhancing the overall exchange student experience.
In conclusion, the SKKUEXS project aims to create a nurturing and inclusive
environment for exchange students, addressing their unique challenges and
fostering a sense of community. We believe that our comprehensive support system
will greatly contribute to the success and well-being of exchange students
at Sungkyunkwan University.
