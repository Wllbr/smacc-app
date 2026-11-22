ZOD - أدوات SMACC  (الإصدار 3.3.17)
================================
made by younis_albaloushy

جديد في الإصدار 3.3.17: مسودات فواتير المبيعات (زر +)، والمخزون دائماً من SMACC
1. زر "+" برتقالي أعلى شاشة فاتورة المبيعات (يسار شعار SMACC): تبقى الفاتورة التي تعمل عليها كما هي في تبويبها
   (مسودة)، وتُفتح فاتورة جديدة في تبويب بجانبه جاهزة كما في F2 (البائع والمخزن ونقدي ونافذة الصنف).
   حتى 5 فواتير مفتوحة في نفس الوقت. إذا لم تكن هناك فاتورة مفتوحة في التبويب فالزر يعمل فاتورة جديدة فيه (F2).
2. عندما تكون أكثر من فاتورة مفتوحة يظهر لكل واحدة زر: رقم المسودة واسم العميل وعدد الأصناف والإجمالي.
   الضغط عليه ينقلك إلى تبويبها (أو Ctrl+Tab كالعادة). الزر الأزرق هو التبويب الذي أنت فيه.
3. بعد حفظ فاتورة جديدة، إذا كانت هناك فاتورة جديدة أخرى مفتوحة: تظهر رسالة "حُفظت الفاتورة …" ويُغلق التبويب
   بعد 3 ثوانٍ وتظهر آخر مسودة كنت تعمل عليها. الطباعة التي يفتحها SMACC بعد الحفظ تبقى أمامك.
   زر "إبقاء مفتوحة" في الرسالة يلغي الإغلاق.
4. لا يُغلق التبويب أبداً إذا: كانت فاتورته آخر فاتورة مفتوحة، أو كان الحفظ تعديلاً لفاتورة محفوظة، أو فاتورة
   Global Blue، أو ظهرت رسالة من SMACC، أو بدأت فيه فاتورة جديدة بأصناف خلال الثواني الثلاث.
5. المسودة موجودة في تبويبها فقط حتى تضغط حفظ: إغلاق التبويب أو تحديث الصفحة (F5) أو تسجيل الخروج يمسحها.
   الإضافة تطلب من Chrome ألا يوقف تبويباً فيه فاتورة مفتوحة لتوفير الذاكرة.
6. المسودات لا تختلط ببعضها: SMACC يرسل رأس الفاتورة وأصنافها معاً لحظة الحفظ فقط.
7. المخزون دائماً من SMACC: كمية الصنف تُطلب من جديد في كل مرة (تُستعمل نفس الإجابة 3 ثوانٍ فقط داخل إدخال
   الصنف الواحد، لأن SMACC يسألها 3 مرات)، وكذلك المخزون في البحث السريع (Ctrl+K). الأسعار وبيانات الصنف
   تبقى 10 دقائق لأنها نادراً ما تتغير، والتكلفة دقيقتين. "تحديث ذاكرة السرعة" في البحث السريع يمسحها فوراً.

جديد في الإصدار 3.3.16: بدون شاشة التحميل، وفاتورة جديدة وأصناف أسرع
1. شاشة التحميل الرمادية (شعار SMACC) لا تظهر عند فتح الصفحات؛ بدلها خط أزرق رفيع يتحرك أعلى الصفحة حتى تجهز.
2. كان SMACC يسأل الخادم نفس الأسئلة مرة بعد مرة والصفحة متوقفة تنتظر. الآن تحفظ الإضافة الإجابات التي لا تتغير
   وتعطيها مباشرة (ما قيس على صفحة فاتورة المبيعات):
   - فتح الصفحة: أسرع بنحو ثانية إلى ثانيتين (4.7 ثانية قبل، 2.8 إلى 3.5 بعد).
   - فاتورة جديدة (F2): من نحو 3 ثوانٍ إلى أقل من ثانية، بعد أول فاتورة.
   - رقم الصنف: أول مرة من نحو 3.3 إلى 1.9 ثانية؛ نفس الصنف مرة ثانية خلال دقيقتين تقريباً فوري (0.2 ثانية).
   - الكمية: من نحو 1.2 إلى 0.2 ثانية.
3. مدة حفظ الإجابات: الإعدادات (البائع، المخزن، اسم العميل، الخصم، ترتيب قنوات الأسعار، نصوص الشاشات) من 10 دقائق
   إلى 12 ساعة؛ بيانات الصنف 10 دقائق؛ السعر والتكلفة دقيقتان؛ المخزون 30 ثانية؛ تاريخ اليوم 10 دقائق
   (ولا يُستعمل بين 11:50 مساءً و12:10 صباحاً). تواريخ قائمة الفواتير تكتبها الإضافة بنفس تنسيق SMACC.
4. أي حفظ أو حذف في نفس التبويب يمسح بيانات الأصناف المحفوظة (ويمسح الإعدادات أيضاً إذا كان خارج الفواتير
   والمرتجعات وتحويل المخزون)، وتسجيل الدخول يمسح كل شيء. إذا غيّر أحد سعراً أو خصماً من جهاز آخر فقد يظهر
   التغيير هنا بعد دقيقتين (السعر) أو 10 دقائق (الخصم)، أو فوراً بالضغط على "تحديث ذاكرة السرعة" في البحث
   السريع (Ctrl+K).
5. يبقى وقت الخادم كما هو في: فتح فاتورة محفوظة، وحفظ الفاتورة، وأول تحميل للصفحة بعد الدخول؛ هذه يجب أن تأتي
   من SMACC نفسه.

جديد في الإصدار 3.3.15: كل صنف جديد عليه ضريبة القيمة المضافة 15%
1. SMACC يفتح الصنف الجديد بفئة الضريبة "التوريدات الخاضعة للضريبة" لكن المجموعتين الضريبيتين على "اختر".
   الآن عند "اضافة جديد" (وفي نسخ الصنف، وفي نافذة الصنف الجديد من الفاتورة) تُختار تلقائياً:
   - المجموعة الضريبية للمدخلات (المشتريات): ضريبة القيمة المضافة 15% للمشتريات
   - المجموعة الضريبية للمخرجات (المبيعات): ضريبة القيمة المضافة 15% للمبيعات
2. مرة واحدة لكل صنف جديد، بعد فتح النموذج بنصف ثانية تقريباً. يمكنك تغييرها قبل الحفظ ولا تعيدها الإضافة.
3. إذا كانت فئة الضريبة غير "الخاضعة للضريبة" (معفاة، نسبة صفر، خارج النطاق) لا تتغير المجموعات.
   الأصناف المحفوظة سابقاً لا تتغير.

جديد في الإصدار 3.3.14: بطاقة الصنف أسرع (اختيار الفئة، اضافة جديد، حفظ)
1. اختيار فئة من الشجرة كان يوقف الشاشة من 1.2 إلى 3.6 ثانية: SMACC يسأل الخادم 8 أسئلة واحداً بعد الآخر، منها
   تحميل كل أصناف الفئة (حتى 100 كيلوبايت) ليعرف فقط هل فيها أصناف أم لا، وأسئلة عن وحدات الفئة وأسعارها
   وملاحظاتها ورموزها الإضافية، وهي دائماً فارغة للفئة. الإضافة تتذكر هذه الإجابات على هذا الكمبيوتر بعد أول
   مرة (7 أيام)، فاختيار نفس الفئة بعد ذلك يأخذ نحو 0.3 ثانية.
2. "اضافة جديد" كان يحمّل كل أصناف الفئة مرة ثانية ولا يستخدمها: من نحو 0.8 ثانية إلى نحو 0.2 ثانية.
3. "حفظ" الصنف الجديد كان يحمّل كل أصناف الفئة مرة ثالثة قبل الحفظ ولا يستخدمها: هذا الانتظار (0.5 إلى 0.9
   ثانية) لم يعد موجوداً. الحفظ نفسه عند SMACC كما هو.
4. لا يتغير شيء في البيانات: نفس الحقول ونفس النتيجة، فقط بدون انتظار لا فائدة منه. أي حفظ أو حذف في بطاقة
   الصنف يجعل الإضافة تنسى ما تذكرته عن هذا الصنف وفئته، فتسأل SMACC من جديد.

جديد في الإصدار 3.3.12: "made by" متحركة
1. "made by younis_albaloushy" أعلى يسار الشاشة صارت متحركة: موجة حمراء وزرقاء تمر على الحروف بهدوء.
   تظهر فوق نوافذ SMACC أيضاً (مثل نافذة الصنف).
2. الضغط عليها يفتح البحث السريع والاختصارات كما كان (أو Ctrl+K)، والمؤشر يبقى في الخانة التي كنت فيها.

جديد في الإصدار 3.3.10: الأصناف لا تختفي عند تغيير العميل، وشعار جديد
1. فاتورة المبيعات: تغيير العميل بعد إضافة الأصناف (بالكتابة أو بالاختيار من القائمة) كان يمسح كل الأصناف،
   لأن SMACC نفسه يمسحها عند كل تغيير للعميل. الآن تبقى الأصناف كما هي، وتظهر رسالة "الأصناف باقية كما هي".
   - العميل لا يحدد أسعار الأصناف في SMACC (نوع السعر لكل صنف)، فالأسعار والمجاميع لا تتغير.
   - SMACC يكمل كالعادة: الرقم الضريبي والعنوان والجوال وهوية المشتري وأيام الائتمان وإعفاء العميل من الضريبة.
2. نوع الفاتورة يتغير الآن أيضاً بعد إضافة الأصناف: عميل له رقم ضريبي = "فاتورة ضريبية"، والرجوع لعميل بدون
   رقم = "فاتورة مبسطة" (إذا كانت الإضافة هي التي غيّرته). الضريبة والمجاميع لا تتغير (15% في النوعين).
   - في فاتورة تصدير أو فاتورة اسمية بعد إضافة الأصناف يبقى النوع كما هو (قاعدة SMACC)، مع رسالة.
3. شعار جديد للإضافة (ZODDJ): الحروف بلونها الأصلي (رمادي والـ D بالأحمر) على مربع داكن، حتى يظهر واضحاً في
   شريط Chrome الفاتح والداكن. في الأحجام الصغيرة جداً (16 و32) يظهر حرف D الأحمر وحده.

جديد في الإصدار 3.3.9: بحث العملاء منفصل ويعمل فاتورة للعميل مباشرة، نوع الفاتورة تلقائي، وخانة العميل بدون القائمة القديمة
1. خانة العميل في الفاتورة:
   - قائمة SMACC القديمة (رمز واسم فقط) لم تعد تظهر عند الدخول للخانة أو وهي فارغة. القائمة تظهر فقط عند الكتابة.
   - الضغط مرتين على الخانة لم يعد يفتح نافذة "العملاء" (البحث بـ رمز العميل).
   - القائمة تظهر تحت الخانة، أو فوقها إذا كانت المساحة فوقها أكبر، ولا تغطي ما تكتبه أبداً.
   - إذا لم تكن قائمة العملاء جاهزة بعد على هذا الكمبيوتر يبحث SMACC، وتظهر نتائجه بنفس الشكل الجديد.
   - إذا لم يوجد عميل بما كتبت، تسأل الإضافة SMACC عن العملاء المضافين حديثاً (من كمبيوتر آخر) وتعيد البحث.
2. بحث العملاء (جديد، منفصل عن البحث السريع): F8، أو الزر الأخضر بجانب زر البحث أسفل يسار الشاشة.
   اكتب الاسم أو الجوال أو الرقم الضريبي أو السجل التجاري أو رمز العميل، فتظهر النتائج فوراً.
   Enter (أو الضغط على العميل) يعمل فاتورة مبيعات جديدة لهذا العميل مباشرة: العميل والبائع والمخزن، ثم نافذة الصنف.
   - إذا كانت فاتورة جديدة مفتوحة للإضافة يوضع العميل فيها (وتفتح نافذة الصنف إذا لم يكن فيها أصناف).
   - إذا كان مستند مفتوحاً للتعديل تُفتح الفاتورة الجديدة في تبويب جديد، فلا يضيع شيء.
   - من أي شاشة أخرى ينتقل إلى فاتورة المبيعات الجديدة بالعميل.
   - Ctrl+Enter أو Ctrl+ضغط أو زر "بطاقة": بطاقة العميل في تبويب جديد. الأسهم للتنقل، Esc للإغلاق.
3. البحث السريع (Ctrl+K) صار للفواتير والمرتجعات والأصناف فقط. إذا كتبت فيه اسماً أو جوالاً يظهر سطر
   "ابحث عن ... في العملاء" يفتح بحث العملاء بنفس النص (أو اضغط Enter أو F8).
4. نوع الفاتورة: عند اختيار عميل له رقم ضريبي في فاتورة مبيعات (جديدة أو عند التعديل) يصبح النوع "فاتورة ضريبية"
   تلقائياً وتظهر رسالة بذلك، وإذا غيّرت العميل لعميل بدون رقم ضريبي يرجع "فاتورة مبسطة".
   - فقط قبل إضافة الأصناف: SMACC لا يسمح بتغيير النوع بعدها، فتظهر رسالة تنبهك.
   - يمكنك تغيير النوع بنفسك كالعادة، ولا تغيّره الإضافة مرة أخرى إلا إذا تغيّر العميل.

جديد في الإصدار 3.3.8: إصلاح بحث العملاء، والبحث عن العميل في قائمة الفواتير والمرتجعات
1. سبب المشكلة في 3.3.7: قائمة العملاء تُحمّل أول مرة على دفعات (1000 عميل كل مرة) فقط عندما لا يُستخدم SMACC،
   وكان الانتقال لصفحة أخرى قبل انتهائها يلغي التحميل، والصفحة التالية لا تعيد المحاولة لمدة دقيقة. فلم تجهز
   القائمة، وكان البحث يقول "لا يوجد" بدل "قيد التحميل".
   الآن: كل دفعة تُحفظ فوراً، والصفحة التالية (أو تبويب آخر) تكمل من حيث توقفت. وحتى تجهز يظهر في Ctrl+K:
   "قائمة العملاء قيد التحميل لأول مرة (12000 من 14372)"، وتظهر النتائج وحدها عند جاهزيتها.
2. Ctrl+K: رقم جوال (05xxxxxxxx أو 9665xxxxxxxx) أو رقم ضريبي لا يبحث في الأصناف، فيظهر العملاء فقط.
   والعميل الذي جواله مكتوب داخل اسمه يظهر أيضاً عند البحث بالجوال.
3. خانة البحث في قائمة فواتير المبيعات وقائمة مرتجعات المبيعات، عند اختيار "اسم العميل":
   اكتب جزءاً من الاسم، أو الجوال، أو الرقم الضريبي، أو السجل التجاري، فيظهر العملاء المطابقون تحت الخانة.
   اختر العميل بالضغط، أو بالأسهم ثم Enter، فيُكتب اسمه الكامل كما هو في SMACC ويبحث SMACC به.
   - مثال: "شركة امكان المتحدة للمقاولات العامة" لم تكن تظهر، لأن اسمها في SMACC فيه مسافتان بين بعض الكلمات
     وSMACC يبحث عن النص كما كُتب حرفياً. الآن تظهر فواتيرها الثلاث.
   - إذا طابق عميل واحد فقط يكفي Enter أو زر البحث مباشرة.
   - Enter في هذه الخانة صار يبحث (كان SMACC عند Enter يضغط زر الحفظ المخفي ولا يبحث).
   - إذا لم يطابق أي عميل يبحث SMACC بالنص كما هو، مثل قبل.

جديد في الإصدار 3.3.7: البحث عن العملاء بالاسم أو الجوال أو الرقم الضريبي أو السجل التجاري، وتنبيه التكرار
1. خانة العميل (فاتورة المبيعات، المرتجع، عرض السعر، الطلب...): اكتب جزءاً من الاسم، أو رقم الجوال
   (بـ 05 أو 966 أو بدونهما)، أو الرقم الضريبي، أو السجل التجاري، فيظهر العملاء المطابقون فوراً بدون انتظار
   الخادم، ومع كل عميل: رمزه وجواله ورقمه الضريبي وسجله. الرقم الذي طابق يظهر بالأخضر.
   اختيار العميل يعمل كما في SMACC تماماً.
   - الاسم: كل الكلمات المكتوبة يجب أن تكون في الاسم، بأي ترتيب، ولا فرق بين ة/ه و أ/إ/آ/ا و ى/ي.
   - رقم قصير (أقل من 7 أرقام) يبحث في رمز العميل أولاً.
2. Ctrl+K (البحث السريع) يجد العملاء بنفس الطريقة. الضغط على العميل يضعه في فاتورة المبيعات المفتوحة للإضافة
   أو التعديل، وإلا يفتح بطاقة العميل في تبويب جديد.
3. تنبيه التكرار: عند إضافة عميل أو تعديله (شاشة العملاء، أو "إنشاء" بجانب خانة العميل في الفاتورة)، إذا كان
   الاسم أو الجوال أو الرقم الضريبي أو السجل التجاري مسجّلاً لعميل آخر يظهر تحت الخانة تنبيه أحمر، مثل:
   "رقم الجوال مسجّل للعميل 3752 ...". الضغط على رقم العميل يفتح بطاقته في تبويب جديد. التنبيه لا يمنع الحفظ.
4. العملاء الذين يشتركون مع عميل آخر في الجوال أو الرقم الضريبي أو السجل يظهر بجانبهم "مكرر" في النتائج،
   وتحتهم مع أي عميل.
5. كيف تعمل:
   - أول مرة تحمّل الإضافة قائمة العملاء من SMACC (حوالي 10 ثوانٍ، فقط عندما لا يُستخدم SMACC) وتظهر رسالة
     "قائمة العملاء جاهزة للبحث". القائمة محفوظة على هذا الكمبيوتر فقط ولا تُرسل لأي مكان.
   - بعدها عند فتح أي صفحة تسأل SMACC عن العملاء الجدد فقط، ومرة كل يوم تحمّل القائمة كاملة من جديد.
     العميل الذي يُحفظ على هذا الكمبيوتر يُحدَّث مباشرة.
   - السجل التجاري: أغلب أرقام السجل محفوظة في بطاقة العميل في "نوع معرف آخر / رقم الهوية"، وهي غير موجودة
     في قائمة العملاء. لذلك تقرأها الإضافة من بطاقة كل عميل له رقم ضريبي، بطاقة واحدة كل مرة وفقط عندما
     لا يُستخدم SMACC (حوالي ساعة ونصف من وقت عدم الاستخدام لكل العملاء، وتكمل من حيث توقفت).
     وكل عميل يُختار في فاتورة أو يُفتح في شاشة العملاء يُعرف سجله فوراً.
   - إذا لم تكن القائمة جاهزة بعد، أو كانت خانة العميل فارغة، أو كان ربط العملاء بالبائع مفعّلاً، يبحث SMACC
     بطريقته المعتادة.

جديد في الإصدار 3.3.6: فاتورة جديدة أسرع (F2 وبعد تسجيل الدخول)
   من F2 حتى ظهور قائمة الأصناف: كان حوالي 4.3 ثانية، صار حوالي 3.1 ثانية (تم القياس على SMACC نفسه).
1. SMACC يسأل الخادم نفس السؤال عدة مرات خلال ثانية والصفحة متجمّدة: بيانات العميل 3 مرات، الخصم مرتين،
   التاريخ مرتين. إذا تكرّر نفس الاستعلام (للقراءة فقط) خلال ثانيتين ولم يُرسل شيء آخر للخادم بينهما،
   تعطيه الإضافة نفس الجواب الذي وصل للتو بدل الانتظار مرة أخرى. أي شيء آخر يُرسل للخادم (مثل الحفظ) يمسح هذه الأجوبة.
   وكذلك سؤال SMACC عن "عميل بدون رقم" (جوابه دائماً: لا يوجد) تجيب عليه الإضافة مباشرة.
2. عند تعبئة البائع كان SMACC يضع المؤشر في خانة المخزن الفارغة فيفتح قائمة كل المخازن من الخادم، وهذا
   كان يؤخّر الخطوات التالية نصف ثانية، مع أن الإضافة تعبّئ المخزن بعدها مباشرة. أثناء التعبئة لا تُفتح هذه القائمة.
3. نافذة الصنف تظهر فوراً بدون حركة الانزلاق (كانت نصف ثانية)، فتظهر قائمة الأصناف أسرع.
4. بعد تسجيل الدخول تبدأ الفاتورة الجديدة مباشرة بعد تحميل الصفحة (كان هناك انتظار إضافي 0.3 ثانية).
   باقي وقت الدخول من SMACC نفسه: صفحة الفاتورة حجمها 2.5 ميجا وتصل بدون ضغط، وبدء تشغيلها حوالي 5 ثوانٍ.

جديد في الإصدار 3.3.5:
1. نافذة الصنف (إضافة جديد) تُغلق فوراً بزر × أو "الغاء"، حتى وقائمة الأصناف مفتوحة.
   كان SMACC عند الخروج من خانة رمز الصنف (أو الكمية أو السعر أو الخصم) يعيد فحصها بطلبات للخادم
   تُوقف الصفحة، حتى لو كانت الخانة فارغة، فتتجمّد الصفحة من ثلث ثانية إلى ثلاث ثوانٍ قبل أن تُغلق النافذة.
   الإلغاء لا يحفظ شيئاً من النافذة، لذلك تتخطى الإضافة هذا الفحص عند الضغط على × أو "الغاء" فقط.
   إذا ضغطت على × ثم سحبت المؤشر بعيداً عنه وبقيت النافذة مفتوحة، يتم الفحص كالمعتاد.

جديد في الإصدار 3.3.4:
1. الصنف في البحث السريع يعرض الآن: سعر التجزئة (بدون ضريبة) والتكلفة والمخزون في كل فرع فقط.
   أُزيلت أسعار الجملة والتوزيع والسعر مع الضريبة. التكلفة هي تكلفة الصنف في السنة المالية الحالية
   (نفس متوسط التكلفة في SMACC). إذا كان سعر التجزئة أقل من التكلفة يظهر بالأحمر مع "السعر أقل من التكلفة".
2. شكل جديد لنافذة البحث السريع: شريط عنوان أزرق، خانة بحث أكبر فيها زر مسح (×)، النتائج في بطاقات
   (اسم الصنف ورمزه يميناً، السعر والتكلفة يساراً، المخزون تحتها)، والمستندات بلون لكل نوع.
   النافذة لا تتجاوز ارتفاع الشاشة، وخانة البحث تبقى ظاهرة والنتائج تتمرّر تحتها.
   الأسهم ↓ ↑ تتنقل بين النتائج، و Enter يفتح المستند أو يعرض تكلفة ومخزون الصنف.
   قائمة الاختصارات مطوية في أسفل النافذة ("اختصارات لوحة المفاتيح")، وتتذكّر الإضافة إن فتحتها.

جديد في الإصدار 3.3.3:
1. سعر الصنف ومخزونه من البحث السريع (Ctrl+K أو زر ⌕)
   اكتب اسم الصنف أو جزءاً منه (مثلاً: جرس ريموت) أو رمزه (مثلاً: 020004)، فتظهر الأصناف وحدها بدون Enter
   (نفس بحث SMACC في نافذة الصنف). لكل صنف:
   - سعر التجزئة (بدون ضريبة) والتكلفة (من الإصدار 3.3.4).
   - المخزون في كل فرع ومستودع، والمجموع (الأخضر = موجود، الرمادي = صفر، الأحمر = بالسالب).
   أول 3 أصناف يظهر مخزونها وحدها، والباقي اضغط على الصنف. زر "نسخ" ينسخ رمز الصنف.
   لا داعي لفتح بطاقة الصنف. أرقام الفواتير والمرتجعات تُبحث كما كانت.
2. لا تعليق عند فتح مستند في تبويب جديد
   كان تبويب SMACC الحالي يتجمّد (حتى ثانية ونصف) أثناء تحميل التبويب الجديد عند الضغط على "↩ إرجاع"
   أو Ctrl + ضغط في البحث السريع أو على فواتير المورد. التبويب الجديد يُفتح الآن منفصلاً تماماً.
3. لا تعليق عند فتح الطباعة
   نافذة الطباعة في SMACC تفتح نافذة الطباعة في Chrome بنفسها، وكان تبويب SMACC يتوقف كله ما دامت
   نافذة الطباعة مفتوحة. الآن تُفتح الطباعة منفصلة، فيبقى SMACC يعمل وهي مفتوحة.
   ملاحظة: كل طباعة تفتح نافذة جديدة (كانت الطباعة الثانية تستخدم نفس النافذة المفتوحة)، فأغلقها بعد الطباعة.

جديد في الإصدار 3.3.2: لا خروج من SMACC بعد 8 دقائق
   في كل صفحة من SMACC مؤقّت خاص به: إذا لم يُحرَّك الماوس أو تُضغط لوحة المفاتيح في أي تبويب
   SMACC لمدة 500 ثانية (حوالي 8 دقائق)، تظهر رسالة "تحذير مهلة الجلسة" مع عدّ تنازلي دقيقة واحدة،
   ثم يخرج من كل التبويبات. العمل في برامج أخرى (واتساب، إكسل…) لا يُحسب استخداماً لـ SMACC.
   هذا كان سبب الخروج المتكرر.
   الآن: ما دام SMACC استُخدم خلال آخر 4 ساعات، تُخبر الإضافة مؤقّت SMACC كل 20 ثانية أنه مستخدم
   (بنفس الطريقة التي يسجّل بها SMACC حركة الماوس)، وإذا ظهرت الرسالة رغم ذلك (مثلاً بعد نوم
   الجهاز) تضغط الإضافة "متابعة" بنفسها. بعد 4 ساعات بدون أي استخدام تتوقف الإضافة، فيخرج SMACC
   كالعادة بعد حوالي 9 دقائق.
   يكفي أن يبقى تبويب SMACC واحد مفتوحاً (ولو في الخلفية).

إصلاح في الإصدار 3.3.1:
   كان Chrome يسجّل "خطأ" للإضافة (زر Errors في صفحة الإضافات) كلما فُتح مستند من البحث السريع
   أو من أزرار الإضافة، لأن روابط الإضافة كانت من نوع javascript: الذي يمنعه Chrome للإضافات.
   الروابط الآن عادية، وكل شيء يعمل كما كان. أُزيلت أيضاً رسائل التحذير التي كانت تظهر في نفس
   القائمة عند انتهاء الجلسة. بعد التحديث يمكن مسح القائمة القديمة بزر "Clear all" في صفحة الأخطاء.

جديد في الإصدار 3.3 (المرتجعات بضغطة واحدة):

1. زر الإرجاع عند عرض فاتورة محفوظة (مبيعات أو مشتريات)
   بجانب "اضافة جديد" يظهر زران:
   - "↩ مرتجع كامل": يفتح تبويباً جديداً فيه مرتجع جديد، والفاتورة محمّلة، وكل الأصناف
     بالكميات المتبقية للإرجاع (نفس خانة "تحديد الكل" في SMACC). سبب الإرجاع في المبيعات يُختار
     تلقائياً "في حالة استرداد البضائع أو الخدمات" (نفس السبب في كل المرتجعات الأخيرة).
   - "↩ مرتجع جزئي": نفس الشيء لكن الكميات صفر، والمؤشر في خانة كمية المرتجع لتكتب ما يرجع فقط.
   راجع المرتجع ثم اضغط "حفظ". الإضافة لا تحفظ شيئاً بنفسها.
   إذا كانت الفاتورة مرتجعة بالكامل يظهر "مرتجع بالكامل" بدل الزرين.
   إذا كان على الفاتورة مرتجع سابق، يُوضع الباقي فقط ويظهر تنبيه بالمرتجع السابق.
   إذا لم يضع SMACC الكمية كاملة لصنف (مثلاً في المشتريات إذا كان الرصيد في المخزن أقل)
   يظهر تنبيه برتقالي بالأصناف والكميات.

2. زر "↩ إرجاع" في قائمة فواتير المبيعات وقائمة فواتير المشتريات
   بجانب رقم كل فاتورة (إلا المرتجعة بالكامل). يعمل مثل "مرتجع كامل".
   Shift + ضغط = مرتجع جزئي.

3. البحث السريع (Ctrl+K أو زر ⌕) بدون Enter
   اكتب الرقم وتظهر النتائج وحدها بعد لحظة. لكل فاتورة يظهر:
   التاريخ، العميل/المورد، المبلغ، المرتجعات السابقة إن وجدت، وزر "↩ إرجاع".
   اضغط النتيجة لفتحها. Enter ما زال يعمل (يفتح أول نتيجة).
   (لا تُفتح النتيجة وحدها حتى لا يُفتح مستند خطأ إذا توقفت في منتصف كتابة الرقم.)

ما سبق في الإصدار 3.2:

1. F2 = إضافة صنف مباشرة (فاتورة المبيعات والمشتريات)
   - إذا لم تكن هناك فاتورة مفتوحة: يفتح فاتورة جديدة، يعبّئ العميل والبائع والمخزن،
     ثم يفتح نافذة الصنف والمؤشر في خانة رمز الصنف (جاهز للباركود).
   - إذا كانت الفاتورة مفتوحة: يفتح نافذة الصنف مباشرة (مثل F3).
   - في فاتورة المشتريات: يفتح الفاتورة الجديدة والمؤشر في خانة المورد،
     لأن SMACC لا يسمح بإضافة صنف قبل اختيار المورد. بعد اختيار المورد اضغط F2 مرة أخرى.
   ملاحظة: يأخذ حوالي 3-4 ثوانٍ لأن SMACC يتحقق من البائع والعميل من الخادم.

2. العميل الافتراضي في فاتورة المبيعات الجديدة = العميل رقم 2 (نقدي)
   يمكن تغييره كالعادة. يظهر في الملاحظة الزرقاء مع البائع والمخزن.

3. بعد تسجيل الدخول تفتح فاتورة مبيعات جديدة مباشرة
   بدلاً من الصفحة الرئيسية (لوحة الرسوم). اضغط Esc لإغلاق نافذة الصنف إذا لم تكن تحتاجها.

4. إبقاء الدخول (عدم الخروج التلقائي)
   ما دام SMACC مفتوحاً ومستخدماً، ترسل الإضافة كل 4 دقائق طلباً صغيراً إلى SMACC
   (سطر واحد من قائمة مرتجعات المشتريات، نفس ما تطلبه صفحات القوائم) حتى لا تنتهي الجلسة.
   إذا لم يستخدم أحد SMACC (لا ضغط ولا كتابة) لمدة 4 ساعات تتوقف الإضافة، ويخرجك SMACC كالعادة.
   مهم: هذا يمنع الخروج بسبب عدم الاستخدام فقط. إذا سُجّل الدخول بنفس اسم المستخدم من جهاز
   أو متصفح آخر، أو أغلق الجهاز أو نام، فقد يُخرجك SMACC رغم ذلك.

5. في أعلى يسار الشاشة: made by younis_albaloushy ورقم الإصدار.
   الضغط عليه يفتح البحث السريع وقائمة الاختصارات.

ما سبق في الإصدار 3.1 (الأصناف وتحويل المخزون بسرعة):

1. نسخ الصنف (في بطاقة الصنف)
   اعرض أي صنف ثم اضغط "⧉ نسخ الصنف" (بجانب "اضافة جديد") أو F4.
   يُفتح صنف جديد في نفس الفئة وفيه كل بيانات الصنف المعروض: الاسم، النوع، الوصف، المورد،
   الضريبة، الوحدات وسعر التكلفة، قنوات البيع والأسعار.
   لا يُنسخ: رمز الصنف والباركود والصورة (لأنها خاصة بكل صنف).
   غيّر الاسم واكتب الباركود ثم احفظ. إذا حاولت الحفظ بنفس الاسم تسألك الإضافة أولاً.

2. صنف جديد من داخل الفاتورة (مبيعات ومشتريات)
   في نافذة إضافة الصنف (F3) يوجد زر أخضر "＋ صنف جديد" أو اضغط F4.
   تفتح بطاقة الصنف في نافذة فوق الفاتورة بدون ترك الفاتورة، وتختار:
   - "نسخة من الصنف ..." : نسخة من الصنف المكتوب في النافذة (مثل رقم 1 أعلاه).
   - "صنف جديد فارغ" : تختار الفئة من شجرة الأصناف (أو تُختار تلقائياً آخر فئة استخدمتها)،
     والضريبة تُعبّأ، والباركود أو الاسم الذي كتبته في الفاتورة يُنقل إلى الصنف الجديد.
   بعد أن تضغط "حفظ" في النافذة (أو Ctrl+S) تُغلق النافذة ويُكتب الصنف الجديد في الفاتورة
   والمؤشر في خانة الكمية.
   إذا كتبت باركوداً غير موجود في الفاتورة تظهر ملاحظة برتقالية فيها زر لإنشاء صنف بهذا الباركود.

3. تحويل مخزون من داخل فاتورة المبيعات
   في نافذة إضافة الصنف يوجد زر أزرق "⇄ تحويل مخزون".
   يظهر رصيد الصنف في كل المخازن، ويُختار تلقائياً المخزن الذي فيه أكثر كمية،
   والكمية المقترحة = الكمية المطلوبة ناقص الموجود في مخزن الفاتورة.
   اضغط "تعبئة التحويل" (أو Enter): تُعبّأ شاشة تحويل المخزون في SMACC
   (من المخزن، إلى مخزن الفاتورة، الصنف، الكمية). راجعها ثم اضغط "حفظ".
   بعد الحفظ تُغلق النافذة ويُحدَّث رصيد الصنف في الفاتورة وتُكتب الكمية المطلوبة.

ملاحظات 3.1:
- الإضافة لا تحفظ شيئاً بنفسها: الصنف الجديد والتحويل يُحفظان فقط عندما تضغط "حفظ" في النافذة.
- Esc أو × يغلق النافذة (يسألك أولاً إذا كان فيها شيء غير محفوظ).
- أول فتح للنافذة في كل صفحة يأخذ عدة ثوانٍ (تُحمَّل شاشة SMACC داخلها)، وبعدها أسرع.
- إذا انتهت جلسة الدخول تظهر صفحة الدخول داخل النافذة: سجّل الدخول وستعود للشاشة المطلوبة.
- نسخ الأصناف ذات أكثر من وحدة لم يُجرَّب بعد: راجع الوحدات بعد النسخ.

ما سبق في الإصدار 3 (السرعة وإدخال الفواتير بسرعة):

1. تحميل أسرع لكل صفحات SMACC
   كل صفحة كانت تطلب من SMACC حوالي 35 نصاً للشاشة واحداً واحداً (حوالي 4 ثوانٍ).
   الإضافة تحفظها في هذا الجهاز 7 أيام، فتفتح الصفحات بعد أول مرة أسرع بحوالي 3-4 ثوانٍ.

2. اختصارات لوحة المفاتيح
   F2          مستند جديد (مرتجع / صنف / عميل… حسب الصفحة). في الفواتير: فاتورة جديدة ونافذة الصنف مباشرة
   Ctrl+S      حفظ (نفس زر "حفظ")
   F3          إضافة صنف: يفتح نافذة الصنف والمؤشر في خانة رمز الصنف (جاهز للكتابة أو الباركود)
   Ctrl+Enter  داخل نافذة الصنف: "إضافة ومتابعة"
   Ctrl+K      بحث سريع برقم الفاتورة أو المرتجع
   F4          صنف جديد (في نافذة الصنف بالفاتورة) · نسخ الصنف (في بطاقة الصنف)
   تعمل مع لوحة المفاتيح العربية أيضاً.

3. تعبئة تلقائية للفاتورة الجديدة (مبيعات ومشتريات)
   عند فتح فاتورة جديدة تُعبّأ تلقائياً من آخر الفواتير المحفوظة على نفس الجهاز:
   البائع والمخزن، وطريقة الدفع إذا كانت نفسها في أغلب آخر الفواتير (مثلاً "أجل" في المشتريات).
   تظهر ملاحظة زرقاء بما تمت تعبئته، ويمكن تغيير أي شيء كالعادة. الخانات المعبأة مسبقاً لا تُغيَّر.

4. فاتورة الشراء: آخر فواتير المورد + تنبيه التكرار
   عند اختيار المورد يظهر سطر بآخر فواتيره هذه السنة (الرقم · التاريخ · المبلغ).
   وإذا أصبح صافي الفاتورة مساوياً لفاتورة أخرى لنفس المورد خلال آخر 60 يوماً
   يظهر تنبيه برتقالي لتتأكد أنها ليست نفس فاتورة المورد مدخلة مرتين.

5. بحث سريع (زر ⌕ أسفل يسار الشاشة أو Ctrl+K)
   اكتب رقم فاتورة أو مرتجع ثم Enter، مثل: INV-106048 أو RINV-10442 أو 0002-2644، أو الرقم فقط.
   إذا وُجد مستند واحد يُفتح مباشرة (عرض فقط)، وإذا وُجد أكثر من واحد تختار منها.
   يبحث في السنة المالية المختارة. Ctrl + ضغط يفتح النتيجة في تبويب جديد.

6. تذكّر عدد السجلات في القوائم
   إذا اخترت 50 أو 100 سجل في أي قائمة، تفتح القائمة بنفس العدد في المرة القادمة.

كما في الإصدار 2 (المرتجعات):
- قائمة الفواتير: رقم المرتجع بجانب رقم الفاتورة، و"مرتجع بالكامل" إذا أُرجعت الفاتورة كلها.
- قائمة المرتجعات: زر لفتح الفاتورة الأصلية، وتنبيه إذا كان لنفس الفاتورة مرتجع آخر.
- شاشة الفاتورة: شريط أحمر إذا كان عليها مرتجع. شاشة المرتجع: تنبيه إذا سبق إرجاع نفس الفاتورة.

مهم:
- الإضافة لا تحفظ أي شيء في SMACC من نفسها. الحفظ فقط عندما تضغط "حفظ" أو Ctrl+S.
- كل ما تتذكره (البائع، المخزن، عدد السجلات، نصوص الشاشات) محفوظ في هذا الجهاز فقط.
- إذا ظهرت نصوص قديمة بعد تحديث من SMACC: افتح البحث السريع واضغط "تحديث ذاكرة السرعة".

التثبيت (مرة واحدة لكل جهاز، في Google Chrome):
1. انسخ هذا المجلد (zod-smacc-returns) إلى مكان دائم على الجهاز، مثل مجلد المستندات (Documents).
   لا تحذفه بعد التثبيت، Chrome يقرأ الإضافة منه.
2. افتح في Chrome العنوان:  chrome://extensions
3. فعّل "وضع المطوّر" (Developer mode) أعلى يمين الصفحة.
4. اضغط "تحميل إضافة غير مضغوطة" (Load unpacked) واختر مجلد zod-smacc-returns.
5. أعد فتح صفحات SMACC.

التحديث من إصدار سابق: استبدل كل ملفات المجلد بالملفات الجديدة، ثم في chrome://extensions
اضغط زر التحديث (⟳) على الإضافة، ثم أعد فتح صفحات SMACC.

ملاحظات:
- إذا غيّرت SMACC تصميم صفحاتها قد تحتاج الإضافة تعديلاً بسيطاً.
- للإزالة: chrome://extensions ثم "إزالة" (Remove).

---------------------------------------------------------------
English (v3.3.17) - made by younis_albaloushy
New in 3.3.17: sales invoice drafts in tabs (fast.js 8, bg.js "drafts", main.js 10); stock always fresh.
1. Bar .zod-drafts (fixed, header, left of the SMACC logo, z-index 1065) on SalesInvoicePage. "+" while an invoice
   is open here: bg.js chrome.tabs.create SalesInvoicePage.aspx#zod-new next to this tab (index+1, openerTabId,
   active) = the usual F2 flow there; max 5 tabs with an invoice open (st add / edit / new). Nothing open here: F2.
2. Each SalesInvoicePage tab sends bg.js {zod:'d', op:'put', info:{st, cust, items, tot, no, vis}} when it changes
   (checked every 1 s; items / total from main.js op 'dr': SMACC's NG GetNGData rows with an ItemCode, sum of
   GrandAmount). bg.js keeps { <tabId>: { n, st, cust, items, tot, no, win, t, act } } in chrome.storage.session
   (n = draft number while open; act = last time the tab was visible), tells every tab (tabs.sendMessage 'dl'),
   sets autoDiscardable false while an invoice is open (memory saver must not unload a draft), drops a tab on
   tabs.onRemoved or when it shows another SMACC page (sessionStorage zod|dr + op 'bye'). No "tabs" permission:
   no addresses or titles are read.
3. Save: SMACC's SaveInvoice sends CollectHeader / CollectAdvanceCollection / CollectGrid then SaveRec (all from the
   page, nothing kept on the server between), so drafts in several tabs do not mix. main.js 10 wraps
   XMLHttpRequest on SalesInvoicePage (top frame): SalesInvoicePage.aspx/SaveRec answered 200 with d containing
   "success" (or "OfflineStandard" in the first part) dispatches zod:invsaved {ins: body "isInserting":"true",
   gb: Global Blue box checked, no: d.split('||')[1]} from the XHR load event (fired inside send for SMACC's sync
   call, before SMACC reads the answer). fast.js: ins && !gb && another tab with st add/new: 3 s countdown with
   "إبقاء مفتوحة", then op 'done' = bg.js activates the other tab with the latest act (tab only, no window focus,
   so SMACC's auto-print popup stays in front) and removes this tab. Not closed when a .modal.in / .ui-dialog is
   visible or a new invoice with items was started meanwhile.
4. Stock fresh: main.js 8 rules AutoCompleteSmartCodeNameSearch (exact) and SelectItemCardCurrentStock now 3 s
   (one item entry asks the stock 3 times within ~1 s); SelectItemCardPriceChannelString 10 min;
   SelectInventoryCost 2 min. Quick search item details (fetch, not XHR) re-used 5 s (was 60 s).

New in 3.3.16: no grey loading screen; faster page start, new invoice and item entry (main.js 8 and 9).
1. Loading screen: #TheLoadingOuterContainer has no CSS display rule, so it covers every page from the first paint
   until a ready handler hides it. main.js (document_start) adds <style id=zod-boot-css> and html.zod-boot (box
   display:none, a 3 px compositor-animated line at the top) until window load + 50 ms (30 s fallback).
   smacc.js CallServerFunction (sync $.ajax) does .modal('show') in beforeSend and .modal('hide') in success/error
   on that box: never painted (the page is frozen), but Bootstrap measures the 2.5 MB page each time (~9 ms per
   call, 42 calls at page start = ~0.4 s). $.fn.modal is wrapped (DOMContentLoaded capture + load): show/hide of
   that box from inside CallServerFunction (Error().stack) while it is not isShown is skipped (hide sets
   display:none, show does $(document).off('focusin.bs.modal') as show+hide would). A box SMACC really shows
   (SaveInvoiceWithDelay, the ZATCA resend wait) still goes through Bootstrap. Stats window.__zodBoxStats.
2. Answer cache (outermost XHR wrapper, sync POSTs only, answered with answer()): measured on SalesInvoicePage a
   page start made 12 sync calls, F2 16 (GetDiscountRate twice, up to 0.8 s each), an item code 16 (CurrentStock
   x3, UnitString x2) and its quantity 5 more. Kept (localStorage, all tabs): SelectCommonString,
   LoadLocalLanguages, SelectAllOutwardTaxGroupIDS_ValidateCalculationMethod, GetSalesmanFromUserProfile (12 h),
   SelectSalesmanDetails (1 h), exact AutoCompleteSearchCodeName for INV_Salesman/Warehouse/CustomersNames
   (30 min), GetDiscountRate, SelectPriorityPriceChannels (10 min), GetSmaccDate (10 min, same local day, not
   23:50-00:10). Kept (sessionStorage, this tab): exact AutoCompleteSmartCodeNameSearch (has price + stock, 30 s),
   GetItemsByParentCode (not on the item card), SelectItemCardDetailString, SelectItemCardUnitNameString,
   GetItemImageInfo, SelectActiveAddOnByItemCode (10 min), SelectItemCardPriceChannelString,
   SelectItemCardUnitString, SelectInventoryCost (2 min), SelectItemCardCurrentStock (30 s). Keys zod|ac|<path>|<body>
   {x expiry, r answer, day}. A POST that is not a lookup (get|select|load|search|check|calculate|autocomplete|
   is|validate|fill|bind|show|generate|zatca|formatting|itemcardnetstock…) clears the tab's answers, and on pages
   other than sales/purchase invoices/returns/orders/quotations and stock transfer the computer's too
   (ClearDocumentImagesInfo, SetServerVariable, SetSessionCountryCode excepted). Login.aspx and zod:trclear
   ("تحديث ذاكرة السرعة") clear everything. Stats window.__zodAcStats.
3. FormattingDates ({ 'date' : 'yyyymmdd,…','isSaveFormat' : 'false'} → d array): every real answer narrows the
   possible formats (d/m/y, m/d/y, y/m/d, d-m-y, …) in localStorage zod|fmtdate {t,c}; while fresh (1 day) the
   add-on answers when every remaining format gives the same text (01/01 fits d/m and m/d); [] = not a plain
   format (Hijri): always asked.
4. Measured by injecting a copy (installed 3.3.15 untouched; test tab, nothing saved): page start in an iframe
   DCL 4.7 s → 3.5 s / 2.8 s (12 → 8 server calls, 42 box toggles skipped); F2 first 2.1 s, then 0.7 s (3 real
   calls; GetSmaccDate was real because it was past midnight); item code 020004 first 1.9 s (12 calls), again
   0.19 s (1 call); quantity 1.2 s → 0.17 s (only ItemCardNetStockInHand). Name, price, unit, header values the
   same. Not tested: a real save (rule), PurchaseInvoicePage (same method names).

New in 3.3.15: every new item gets VAT 15%. SMACC's blank item form has VATCategoryCode "S" but
InwardTaxGroupID / OutwardTaxGroupID "0" (اختر); the only other options are PurchaseTax15 / SalesTax15.
tools.js vatWatch(w) (this page, and the item card window opened from an invoice; one 250 ms watcher per
WindowProxy, which survives the frame's reloads): 450 ms after a new-item form opens (#hdSaveType SaveNew and the
save button visible), once per form, vatDefaults(w) sets an empty category to S and, only while it is S, a group
still "0" to PurchaseTax15 / SalesTax15 with jQuery .val().change() (SMACC then runs
ZATCAComplianceVerifyByTaxGroupIDs, ~0.15 s). copyItem waits (w.__zodCopying) and applies it after copying;
the invoice window's blank item uses it instead of the remembered zod|itemdef taxes. Tested live by injection:
item page add new (twice, a group set back to اختر by hand stays), item page in an iframe before and after a
reload; nothing saved.

New in 3.3.14: a faster item card (ItemCardMasterPage): category click, "اضافة جديد" and حفظ.
1. Measured (sync CallServerFunction calls, one after another): category click = GetItemCardInfoByCode,
   GetItemsByParentCode (all items of the category, 58-102 KB, 0.3-0.9 s), LoadMasterNamesTable,
   GetItemCardUnitInfoByCode (0.2-1.4 s), SelectPriceChannel, GetPriceChannelsByItemCode,
   GetItemCardSpecialCommentsByCode, GetItemCardCodesExtendedByItemCode = 1.2-3.6 s. Add new (postAddCB) =
   LoadLocalLanguages + isSizeColorParentItem -> GetItemsByParentCode (0.8-1.1 s). Save (preSaveCB) =
   isSizeColorParentItem -> GetItemsByParentCode again (0.5 s), ValidateLevelWidth -> SelectItemCodeSetup, SaveRec.
2. SMACC only reads GetItemsByParentCode as "empty or not" (SetSelectedTeeViewNodeInfo: _rec == "" for the
   hdParentItemCode attributes used by postUpdateCB), and isSizeColorParentItem only when the selected tree li
   has sizecolor_support and sub_support "true". A category (SubItemSupport true, SizeOrColorSupport false)
   always answered {"d":""} for units, price channels, special comments and extended codes.
3. main.js section 7 (item card, all frames, outermost XHR wrapper, sync POSTs; the caller is read from
   new Error().stack): GetItemsByParentCode from isSizeColorParentItem -> {"d":""} unless that li is a size /
   colour parent; from SetSelectedTeeViewNodeInfo -> {"d":""} for an item (both flags false in the
   GetItemCardInfoByCode answer just before), '{"d":"[]"}' for a category known to have items (localStorage
   zod|icache kids, 7 days; learnt from the real answer, or a new item saved in it), else the real call. Detail
   lookups from Load...OnTreeItemSelect for a category -> {"d":""} once the server gave exactly that for that
   path and code (7 days). SelectPriceChannel, SelectItemCodeSetup, LoadLocalLanguages: once per page and body.
   Any other POST that is not a lookup (SaveRec, delete...) forgets what was learnt about the current item and
   its parent; a delete forgets every "has items".
4. Tested live by injection (test key, removed afterwards; nothing saved): category 02 1547 -> 356 ms, 04
   1257 -> 335 ms with an identical form (82 values, visibility, unit and price tables, hidden attributes);
   add new 777 -> 243 ms; isSizeColorParentItem() 496 -> 15 ms (same result); item 020007 identical (88
   values); نسخ الصنف still fills the copy.

New in 3.3.12: the "made by" label at the top left is animated.
1. fast.js buildBadge(): one span.zod-bch per letter with animation-delay i*0.06 s (style.css zod-wave: a red /
   blue colour wave with a 2 px bob, 3.2 s; colour only with prefers-reduced-motion), z-index 1065 so it stays
   above SMACC's windows (bootstrap backdrop 1040, modal 1050). mousedown is cancelled so SMACC's field keeps
   its focus. A click opens the quick search as before.

New in 3.3.10: items stay when the customer changes; the invoice type also follows the customer after items
were added; new icons.
1. Cause: SMACC's own jQuery "change" handler on #cpBulk_cpForm_CustomerCode (SalesInvoicePage) runs
   `if (!_isZATCAReGenerateInvoice) $('#BaseGrid').NG('ClearNGData')`, then RefreshFooterCalculations(true),
   process type reset, etc., on EVERY customer change (a native change: typing a new customer, or a pick from the
   list, which fires change when the box loses focus). A jQuery .blur() alone (fast.js / F8) never cleared.
   main.js 6b keepItems() (every 300 ms): wraps that handler (found by "ClearNGData" in its source; h.handler is
   replaced, h.__zodKeep) to return without running while IsRecordExistsInGrid() is true. The customer does not
   set prices (PriceChannelCode is per line); SetCustomerProperties (SCN OnBlur) still fills VAT, address,
   phone, buyer ID, credit days and ApplyOrRemoveTaxOnGridItems(tax exempt).
   IsRecordExistsInGrid() = first `.ng-body .ng-row .RealItem` has a value (BaseGrid is the first .ng-body).
2. Invoice type with items: TaxCategoryCode's change handler refuses while IsRecordExistsInGrid(); its other
   work is UI only (Required on the customer code, export / nominal / Global Blue boxes). On a plain invoice
   (IsExportInvoice, IsNominalInvoice, IsGlobalBlueInvoice unchecked) setType() swaps window.IsRecordExistsInGrid
   for () => false during $(t).val(to).change() and restores it. Measured: 2 x 020004, VAT 6.10, total 46.76 before
   and after 2 -> 1 -> 2.
3. Icons from the ZODDJ logo (scratchpad make-icons.py): masks from the source colours (grey 206, red 247/14/12),
   smoothed, on a rounded dark tile (gradient #2e353d -> #161a1f, thin light rim); 48 / 128 the wordmark, 16 / 32
   the red D. Manifest "icons" now 16, 32, 48, 128.
Tested on SMACC (section 6 copy on top of installed 3.3.9, nothing saved): new invoice with an item, customer
picked from the list -> items kept, type 1, totals unchanged; back to نقدي -> items kept, type 2. Cancelled.

New in 3.3.9: customer box without SMACC's old list; a customer search of its own (F8) that makes the invoice;
invoice type from the customer's VAT number.
1. main.js section 5 (custScn(): table INV_CustomersNames, salesperson linking off, not sub-support / given values):
   the source answers only after typing since the box got focus (input, or ArrowUp/Down: input.__zodTyped);
   SMACC's focus handler searches, and an empty box listed every customer -> resp([]). List ready: always the
   local answer (0 found = no menu; cust.js then calls fresh(); a tail that finds new customers announces
   zod:custnew and main.js searches the focused box again). Not ready: SMACC's AutoCompleteSearchCodeName, its
   items get zod {c, n} so they render the new way. Window-capture dblclick on such a box:
   stopImmediatePropagation (SMACC: old list + the GSD "العملاء" dialog). placeMenu(): below when >= 260 px or
   more than above (above = top - 75 for SMACC's header), max-height inline !important, collision "fit none":
   never over the box (3.3.8 used flipfit, which could cover it).
2. fast.js 5b: customer window .zod-jump.zod-cpan (F8; green .zod-fab.zod-fab-cust at left 60px).
   __zodCust.search(term, 30) on input (120 ms). Enter / click -> invoiceFor(): SalesInvoicePage adding with an
   editable customer box -> jq blur on CustomerCode, then doItem() after headerReady() if the grid is empty
   (main.js op "grid" -> <html data-zod-grid> from IsRecordExistsInGrid()); SalesInvoicePage not editing ->
   pickedCust + doF2() (applyDefaults puts pickedCust instead of نقدي, without ifEmpty); editing -> new tab
   SalesInvoicePage.aspx#zod-new=<code>; other pages -> location.href to it. Start-up reads #zod-new(=<code>).
   Ctrl+Enter / Ctrl+click / middle click / "بطاقة" -> CustomersPage.aspx#zod-open=<code> in a new tab.
3. Ctrl+K: no customers listed any more (jCusts stays null). A customer-like query (custQuery()) gets one
   .zod-jgo row that opens the customer window with the text; Enter does the same when there are no items.
4. main.js section 6 (SalesInvoicePage, top window): every 300 ms and after a fill, key = customer code + "|" +
   #cpBulk_cpForm_VATNumber. On a change, while adding / editing (visible .btnSaveAddUpdate), not for a saved
   invoice as first seen, not while the code box has focus, and only if !IsRecordExistsInGrid(): a valid VAT
   number (^3\d{13}3$, more than 2 distinct digits) -> #cpBulk_cpForm_TaxCategoryCode = 1 with .change()
   (SMACC's own handler); a customer without one -> 2, only if the add-on had set 1. Items in the grid + VAT
   customer + type 2 -> a toast only (SMACC refuses the change then).
Tested on SMACC (page copies on top of the installed 3.3.8, nothing saved): focus on the box holding "2" -> no
list; "عبقري" -> the new list under the box, no overlap; double click -> no dialog; SMACC's search path -> rows
in the new style; F8 "12849" + Enter on a new invoice -> customer, VAT, type 1, item window; "2" + Enter ->
type 2; from the list, F8 "مؤسسة العبقري" + Enter -> new invoice for 637 with salesperson, warehouse, type 1 and
the item window; Ctrl+K "0558537576" -> link row, Enter -> customer window with that customer; arrows / Esc.
Invoices cancelled, no save calls. Not tested live: #zod-new=<code> from another screen or a new tab (needs
3.3.9 installed).

New in 3.3.8: customer search fixed; customer picker in the invoices / returns list search box.
1. Cause (3.3.7): the first list fetch (15 calls of 1000, only while idle) was lost when the page changed before
   it finished, and its lock (60 s, no owner) kept the next page from retrying. Now (cust.js): every chunk is
   stored in "zodcustp1|<host>" {v:1, t0, total, page, got, data}; the next page or tab resumes from it (if
   under 6 h old) and removes it when done. Lock zod|cust|lock + zod|cust|lockby (this page's id), renewed
   every 3 s, stale after 15 s, released on pagehide; a tab that finds it locked checks every 5 s and takes
   over. Events zod:custprog / zod:custready; __zodCust.progress() = {got, total} until the list is there.
   Measured: left the page at 12000 / 14372, the next page made 3 calls and finished (14372, no duplicates).
2. fast.js Ctrl+K: while the list loads, the customers section says "قيد التحميل (got من total)" and fills in on
   zod:custready. No item search for a mobile (^(00966|966|0)?5\d{8}$) or VAT number (^3\d{13}3$). Not-found
   messages name what was searched. Search: digit runs of 7+ inside a customer's name count as a mobile.
3. cust.js list box: on any page with #ddlSearchOptionSelect = "CustomerName", #txtPageListingSearch and
   #BtnPageListSearch (SalesInvoicePage, SalesReturnPage). NOTE: #btnSearch is the GSD dialog's hidden button.
   SMACC's CustomerName list search is LIKE on the raw name, so a name stored with double spaces is not found
   when typed normally. Typing shows div.zod-lbox (fixed, under the box) with up to 8 matching customers;
   click / ArrowUp/Down + Enter puts the customer's exact raw name in the box and clicks #BtnPageListSearch.
   Enter or a real click on the search button with exactly one matching customer uses that name. SMACC's own
   Enter in that box (keypress) clicks the toolbar's hidden .btnSave3 instead of searching: with "اسم العميل"
   chosen, keydown Enter is cancelled (no keypress) and the add-on searches instead.
   Tested: 0500920887 + Enter -> 3 invoices of 11504; "عبقري" + Down Down + Enter -> 5 invoices of 637;
   0502682919 + mouse on the search button -> INV-110126; "zzqx" + Enter -> SMACC search, 0 rows, no save call.

New in 3.3.7: find customers by name, mobile, VAT or CR number, and duplicate warnings. New file cust.js
(isolated world, document_idle). Never saves anything.
1. Customer list in chrome.storage.local "zodcust1|<host>" ({v:2, t, total, data}; one string, rows split by \x1e,
   fields by \x1f: code, name, phone 1, phone 2, VAT, CCR, stopped), from CustomersPage.aspx/LoadPageListing,
   1000 rows a call (14372 customers: 15 calls, ~10 s, 0.8 MB stored), only while SMACC is idle: quiet() waits
   for no input in this tab or any other (localStorage zod|cust|in) and no SMACC loading modal; a cross-tab
   lock (zod|cust|lock). Each page: one small call for new customers (tail, at most every 30 s); a full fetch
   once a day, or when customers were deleted. main.js sees CustomersPage SaveRec/UpdateRec/InsertRec/DeleteRec
   (zod:custsaved) and that customer is fetched again.
2. Buyer IDs (OtherBuyerID / BuyerIDValue; most CR numbers are there as type CRN) are not in the list. They are
   kept in "zodcustb1|<host>" (code -> [type, value]): from every CustomersPage LoadRec reply SMACC gets itself
   (main.js zod:custrec; the invoice uses LoadRec when a customer is chosen), and, for customers with a VAT
   number, one LoadRec at a time in the background (>= 0.5 s apart, only while idle, cross-tab lock
   zod|cust|blk, resumable; ~7170 cards, ~160 ms each, about 80 min of idle time). Stops on any error.
3. main.js section 5: SCN customer boxes (table INV_CustomersNames) answer from the local list (sync
   CustomEvent zod:custq -> zod:custa) when salesperson linking is off (optionalParam empty or "false,..."),
   not SearchInGivenValues, not sub-support, and the term is not empty; otherwise SMACC's own
   AutoCompleteSearchCodeName as before. Items stay SMACC's {Code, Name}, so focus/select are unchanged;
   _renderItem shows code, name, mobile, VAT, CR (the matched one in green), مكرر, موقوف; wider menu.
4. Search: digits -> exact code, then full mobile (+, 00, 966 and leading 0 ignored), exact VAT / CR / buyer ID,
   code contains (<= 6 digits), mobile contains, VAT / ID contains. Text -> every word typed, Arabic normalised
   (ة/ه, أ/إ/آ/ا, ى/ي, tashkeel). About 15 ms on 14372 customers.
5. fast.js Ctrl+K: a customers section (up to 8). Click / Enter on a sales invoice being added or edited puts
   the customer on it (blur on the code box, as if typed); otherwise opens CustomersPage#zod-open=<code> in a
   new tab, where cust.js clicks SMACC's own "view" action for that code.
6. Duplicate warnings (checkForms every 700 ms and on input) under name, phone 1/2, VAT, CCR and the buyer ID
   (when a type is chosen) in the CustomersPage form and the invoice's "new customer" (إنشاء) form; the
   customer's own code is left out. Advisory only. Mobile numbers with 2 or fewer distinct digits are ignored.
Tested on SMACC without saving: list build 8-13 s; mobile / VAT / name search in the invoice customer box with
no server call; picking fills the customer as before; Ctrl+K by name / VAT / mobile and picking; warnings in
both forms (then cancelled, no save calls); #zod-open. Not tested: arrow keys and Enter in the menu (the test
browser can't send them; mouse picking works), and the refresh after a real customer save.

New in 3.3.6: faster new invoice (F2 and right after login). Measured on SMACC: F2 -> item list about 4.3 s -> 3.1 s.
1. main.js 1b: a SYNC POST to a read-only lookup (CommonWebService GetSmaccDate, SelectSalesmanDetails,
   AutoCompleteSearchCodeName; CustomersPage LoadRec; <page>/GetDiscountRate; CompanyProfile LoadLocalLanguages)
   with exactly the same body as the latest real call to that address, within 2 s, is answered with that call's
   response (the translation cache's answer()). Any other XHR (any address, sync or async) forgets every answer.
   CustomersPage LoadRec with key '' (salesperson filled before the customer) is answered {"d":""} locally,
   which is what the server always returns. New-invoice trace: 4 repeats + 1 empty-customer call answered.
2. fast.js applyDefaults sends one {op:'fill', steps:[...]} to main.js (steps: salesperson, customer, warehouse
   with ifEmpty; payment type with ifDiff). While it runs, the autocompletes of those boxes ignore empty searches:
   SMACC's SetWarehouse() focuses the empty warehouse box after the salesperson, and SCN's focus handler started
   a full warehouse search (async, ~1.8 s on the server) that held up the next blocking lookups by ~0.5 s.
3. The item window (*DetailOuterContainer) loses Bootstrap's "fade" class on show.bs.modal, so it shows and hides
   at once (was ~0.5 s of backdrop + slide), and the item list search starts right away.
4. After login (#zod-new) doF2 runs right after the load event (was +300 ms); F2 waits look every 30 ms (was 100).
   The rest of the login time is SMACC's: SalesInvoicePage is 2.5 MB of uncompressed HTML (~2.2 s) and its
   start-up runs ~4.8 s (LoadPageListing ~0.6-1.2 s and ~15 blocking calls).

v3.3.5:
1. The item window (اضافة جديد) closes at once with X or "الغاء", also while the item list is open.
   Leaving the item code box (or quantity, price, discount) made SMACC check it again with blocking server
   calls (SelectItemCardDetailString, SelectItemCardCurrentStock, GetDiscountRate, ...), even when the box was
   empty, so the tab froze for 0.3 to 3 seconds before the window closed. Cancelling keeps nothing from the
   window, so main.js skips those checks (change/blur/focusout of the box being left) only when that box is
   left by pressing X or الغاء in the item window. If the press is dragged off the button and the window stays
   open, the skipped checks run after all.

v3.3.4:
1. Items in quick search now show only the retail price (before VAT), the cost and the stock per branch.
   Wholesale, distribution and the VAT-inclusive price were removed. Cost = CostPrice of unit 1 from
   SelectItemCardUnitString for the current fiscal period (equal to AverageCost on every item checked).
   A retail price below cost is shown in red with "السعر أقل من التكلفة".
2. Quick search redesign: blue title bar, bigger search field with a clear (x) button, result cards (item name
   and code on the right, price and cost on the left, stock underneath), a coloured badge per document type,
   one scroll area under a fixed search field, never taller than the window, Up/Down arrows move between results
   (Enter opens a document or loads an item's cost and stock), and the shortcut list folds away at the bottom
   (its open/closed state is remembered).

v3.3.3:
1. Price check in quick search (Ctrl+K): type an item name (or part of it) or its code; matching stock items show
   without Enter (SMACC's own item-window search). Each shows its item-card prices (retail, wholesale,
   distribution - before VAT, as SMACC stores them; checked with SMACC's own tax calculation: SalesTax15 is 15 %,
   not included), the retail price with 15 % VAT (tax rounded to 2 decimals, then added, like SMACC), and the stock
   in every branch / warehouse plus the total. The first 3 items load by themselves (one request at a time); click
   any other item to load it. "نسخ" copies the item code. Invoice and return numbers are searched as before; a
   number with a known document prefix (INV-, 0002-…) skips the item search, and words skip the document search.
2. No freeze when a new tab opens: add-on tabs (return button, Ctrl+click, supplier invoices) open with
   "noopener", so Chrome gives them their own process (the current tab stalled up to 1.4 s before).
3. No freeze while a print is open: SMACC opens its print pages (PrintReport.aspx, FAPrintReport.aspx …) with
   window.open and the print page opens Chrome's print dialog itself, which paused the SMACC tab until the dialog
   closed. main.js now adds "noopener" to window.open for print pages (SMACC never uses the window it gets back
   there; the add-on returns a harmless stand-in). Each print now opens its own window. Blob PDF prints and other
   windows are unchanged.

v3.3.2:
New in 3.3.2: no more logout after 8 minutes. Every SMACC page has its own idle timer: after 500 seconds without
mouse or keys in any SMACC tab it shows "تحذير مهلة الجلسة" with a 1-minute countdown and logs every tab out (work
in other programs does not count). While SMACC was used in the last 4 hours the add-on now tells that timer every
20 seconds that SMACC is in use (by firing SMACC's own "mouseclick" activity event, which nothing else listens to),
and presses SMACC's own "متابعة" if the warning shows anyway (e.g. after the computer slept). After 4 hours without
use it stops, and SMACC logs out as usual. One open SMACC tab (even in the background) is enough.

v3.3.1:
Fix in 3.3.1: Chrome listed an add-on error each time a document was opened from quick search or an add-on
link, because those links used "javascript:" addresses, which Chrome blocks for add-ons. Links now point to "#"
(cancelled by their click handler) and the hidden "view" link has no address. Warnings written to the console
when SMACC's session had ended were removed too. Use "Clear all" on the add-on's Errors page once after updating.

v3.3:
New in 3.3: returns in one click. A viewed (saved) sales or purchase invoice gets "full return" and "partial return"
buttons next to "Add new"; invoice lists get a "return" button on every invoice that is not fully returned
(Shift+click = partial); quick search results get it too. It opens a new return in a new tab with the invoice
loaded; full = SMACC's own "select all" (the quantity still available to return), partial = quantities left at 0
with the cursor in the first quantity box. Sales returns get the reason "goods returned" (4) when empty, as all
recent returns use. Nothing is saved until you press Save. Quick search now searches by itself while you type
(no Enter needed) and shows each invoice's earlier returns.

v3.2:
New in 3.2: F2 on sales/purchase invoices goes straight to adding an item (new invoice, header filled, item
window with the cursor in the item code; on an open invoice it just opens the item window; purchase invoices
stop at the supplier box first because SMACC needs the supplier before items). New sales invoices get customer
no. 2 (نقدي). After login SMACC opens a new sales invoice instead of the dashboard. Stay logged in: while SMACC
is being used, one small list request every 4 minutes keeps the session alive; after 4 hours with no key or
click in SMACC it stops and SMACC logs out as usual (it cannot prevent logouts caused by the same login being
used on another computer/browser). Top-left label with the maker and version; click it for quick search/help.

v3.1:
New in 3.1: "Copy item" button (or F4) on the item card opens a new item with everything of the shown item except
code, barcode and picture (asks before saving with an unchanged name). In the sales/purchase invoice item window
(F3): "+ New item" (or F4) opens the item card in a window over the invoice, as a copy of the item in the window or
blank (category remembered, taxes filled, the typed barcode/name carried over); after you press Save there, the new
item is put into the invoice line. Sales invoice item window: "Stock transfer" shows the item's stock in every
warehouse, picks the one with most stock, suggests wanted minus on hand, fills SMACC's stock transfer screen; you
review and press Save, then the invoice line is refreshed. The add-on never saves by itself. The first opening of a
window takes a few seconds. Multi-unit item copy is untested: check the units after copying.

v3:
New: faster page loads (SMACC's ~35 screen-text requests per page are cached on this computer for 7 days);
keyboard shortcuts F2 new, Ctrl+S save, F3 add item (cursor in the item code box), Ctrl+Enter "add and continue"
in the item window, Ctrl+K quick search; new sales/purchase invoices pre-fill salesperson, warehouse and the usual
payment method from the last invoices saved on this computer (empty fields only, a blue note says what was filled);
purchase invoice shows the supplier's recent invoices and warns when another invoice of the same supplier in the
last 60 days has the same total; quick search by invoice/return number (button bottom-left); list page size is
remembered per screen. Plus everything from v2 (returns next to invoices, warnings on return screens).
Nothing is ever saved in SMACC by the add-on itself.
Install: copy this folder somewhere permanent -> chrome://extensions -> Developer mode -> Load unpacked.
Upgrade: replace all files, press the reload button on the extension, reopen SMACC pages.
