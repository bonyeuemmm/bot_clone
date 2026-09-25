const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Collection, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const mongoose = require('mongoose');
const crypto = require('crypto'); // Sử dụng để tạo Token và 2FA ngẫu nhiên bảo mật

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_ID = process.env.OWNER_ID || '1208450889246048306';
const MONGO_URI = process.env.MONGO_URI;

const MAIN_SERVER_ID = '1454813193028374540';
const SERVER_INVITE_LINK = 'https://discord.gg/z7RUNArBuJ';

const COLORS = {
  DEFAULT: 0x9b59b6,
  MEMBER: 0x3498db,
  SUCCESS: 0x2ecc71,
  ADMIN: 0xf1c40f,
  OWNER: 0xe67e22,
  ERROR: 0xe74c3c
};

const FOOTER_ICON_URL = 'https://i.postimg.cc/gJbhCmHL/Pain-Gamer.png';

mongoose.connect(MONGO_URI)
  .then(() => console.log('🍃 Kết nối MongoDB thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

/* ---------------- SCHEMA DỮ LIỆU MONGODB ---------------- */

const KeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  durationMs: Number,
  activatedAt: Date,
  expiresAt: Date
});

const AccessSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  expiresAt: Number,
  durationMs: Number,
  warned24h: { type: Boolean, default: false },
  warned4h: { type: Boolean, default: false }
});

const LinkSchema = new mongoose.Schema({
  category: { type: String, required: true, unique: true },
  links: { type: mongoose.Schema.Types.Mixed, default: { free: {}, premium: {} } }
});

const AdminSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }
});

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }
});

// --- SCHEMA MỚI TÍCH HỢP QUẢN LÝ TOKEN & 2FA WEBSITE ---
const AuthWebSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  token: { type: String, required: true, unique: true },
  twoFactorCode: { type: String, default: null },
  twoFactorExpiresAt: { type: Number, default: 0 },
  pcoin: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const KeyModel = mongoose.model('Key', KeySchema);
const AccessModel = mongoose.model('Access', AccessSchema);
const LinkModel = mongoose.model('Link', LinkSchema);
const AdminModel = mongoose.model('Admin', AdminSchema);
const UserModel = mongoose.model('User', UserSchema);
const AuthWebModel = mongoose.model('AuthWeb', AuthWebSchema);

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] 
});

const commandCooldowns = new Collection();
const COMMAND_COOLDOWN_MS = 10000;

function formatFooterText() {
  return 'Bot By PAIN';
}

function createBotEmbed({ title, description, fields, user, locale = 'vi', color = COLORS.DEFAULT, timestamp = Date.now() } = {}) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setFooter({ 
      text: formatFooterText(), 
      iconURL: FOOTER_ICON_URL 
    });

  if (user) {
    embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }));
  }

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields?.length) embed.addFields(fields);

  return embed;
}

// --- HÀM GỬI LOG THAO TÁC QUẢN TRỊ VỀ DM CHO OWNER ---
async function sendOwnerLog(actionTitle, fields = [], adminUser) {
  try {
    const owner = await client.users.fetch(OWNER_ID);
    if (!owner) return;

    const logEmbed = createBotEmbed({
      title: `🛡️ LOG ADMIN: ${actionTitle}`,
      description: `Thao tác được thực hiện bởi Admin: **${adminUser.tag}** (ID: \`${adminUser.id}\`)`,
      fields: [
        ...fields,
        { name: '⏰ Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      ],
      color: COLORS.OWNER,
      user: adminUser
    });

    await owner.send({ embeds: [logEmbed] });
  } catch (err) {
    console.error('Không thể gửi Log về DM cho Owner:', err);
  }
}

async function autoScanAndCleanExpiredKeys() {
  const now = Date.now();
  const allAccess = await AccessModel.find({});

  for (const userData of allAccess) {
    if (userData.expiresAt !== -1 && Number.isFinite(userData.expiresAt) && now >= userData.expiresAt) {
      try {
        const user = await client.users.fetch(userData.userId);
        await user.send({
          embeds: [
            createBotEmbed({
              title: '⏰ Thông Báo Hết Hạn Key',
              description: 'Thời hạn sử dụng bot của bạn đã hết. Quyền truy cập bot đã tự động bị thu hồi!',
              user,
              color: COLORS.ERROR
            })
          ]
        });
      } catch (_e) {}

      await AccessModel.deleteOne({ userId: userData.userId });
      continue;
    }
  }
}

setInterval(autoScanAndCleanExpiredKeys, 30000);

/* ---------------- KHAI BÁO LỆNH SLASH COMMANDS ---------------- */

const commands = [
  new SlashCommandBuilder()
    .setName('getclonepre')
    .setDescription('Lấy đường dẫn tải bản Clone Roblox Premium (Yêu cầu Key)')
    .addStringOption(option =>
      option.setName('region')
        .setDescription('Chọn khu vực máy chủ')
        .setRequired(true)
        .addChoices(
          { name: '🌍 Global', value: 'global' },
          { name: '🇻🇳 VNG', value: 'vng' }
        )),

  new SlashCommandBuilder()
    .setName('getclonefree')
    .setDescription('Lấy đường dẫn tải bản Clone Roblox Miễn Phí')
    .addStringOption(option =>
      option.setName('region')
        .setDescription('Chọn khu vực máy chủ')
        .setRequired(true)
        .addChoices(
          { name: '🌍 Global', value: 'global' },
          { name: '🇻🇳 VNG', value: 'vng' }
        )),

  new SlashCommandBuilder()
    .setName('setadmin')
    .setDescription('Quản lý quyền Admin Bot (Thêm hoặc Xóa)')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Chọn hành động')
        .setRequired(true)
        .addChoices(
          { name: 'Add (Thêm Admin)', value: 'add' },
          { name: 'Remove (Xóa Admin)', value: 'remove' }
        )
    )
    .addUserOption(option => option.setName('user').setDescription('Chọn người dùng').setRequired(true)),

  new SlashCommandBuilder()
    .setName('createkey')
    .setDescription('Tạo key mới')
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Thời hạn của key')
        .setRequired(true)
        .addChoices(
          { name: '1 Ngày', value: '1d' },
          { name: '3 Ngày', value: '3d' },
          { name: '7 Ngày', value: '7d' },
          { name: '30 Ngày', value: '30d' },
          { name: 'Vĩnh viễn', value: 'permanent' }
        )
    )
    .addUserOption(option => option
      .setName('target_user')
      .setDescription('Member nhận key (không bắt buộc)')
      .setRequired(false)),
    
  new SlashCommandBuilder()
    .setName('setlinkclone')
    .setDescription('Tải và thiết lập link + phiên bản cho từng mục')
    .addStringOption(opt => opt.setName('type').setDescription('Loại bản Clone (Free hoặc Premium)').setRequired(true).addChoices(
      { name: '🎁 Free (Miễn phí)', value: 'free' },
      { name: '👑 Premium (Key VIP)', value: 'premium' }
    ))
    .addStringOption(opt => opt.setName('category').setDescription('Tên mục (VD: Delta X)').setRequired(true))
    .addStringOption(opt => opt.setName('region').setDescription('Khu vực').setRequired(true).addChoices({ name: 'Global', value: 'global' }, { name: 'VNG', value: 'vng' }))
    .addStringOption(opt => opt.setName('link').setDescription('Đường link tải').setRequired(true))
    .addStringOption(opt => opt.setName('status').setDescription('Trạng thái').setRequired(true).addChoices(
      { name: '🟢 Hoạt động', value: 'active' },
      { name: '🟡 Đang bảo trì / Chờ update', value: 'maintenance' },
      { name: '🔴 Ngừng hoạt động', value: 'disabled' }
    ))
    .addStringOption(opt => opt.setName('version').setDescription('Phiên bản (VD: v2.640)').setRequired(false))
    .addStringOption(opt => opt.setName('note').setDescription('Ghi chú / Tính năng').setRequired(false)),

  new SlashCommandBuilder()
    .setName('setstatus')
    .setDescription('Chọn bản Clone và khu vực để cập nhật trạng thái'),

  new SlashCommandBuilder()
    .setName('removelink')
    .setDescription('Xóa bản Clone theo khu vực hoặc toàn bộ dữ liệu'),

  new SlashCommandBuilder()
    .setName('redeemkey')
    .setDescription('Nhập key để kích hoạt')
    .addStringOption(option => option.setName('key').setDescription('Nhập mã key').setRequired(true)),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Kiểm tra thời hạn sử dụng bot còn lại của bạn'),

  new SlashCommandBuilder()
    .setName('removekey')
    .setDescription('Xóa key và thu hồi quyền của member')
    .addStringOption(option => option.setName('key').setDescription('Key cần xóa').setRequired(true)),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Hướng dẫn sử dụng bot'),

  new SlashCommandBuilder()
    .setName('notification')
    .setDescription('Gửi thông báo đến các member đã sử dụng bot')
    .addStringOption(option => option
      .setName('message')
      .setDescription('Nội dung thông báo muốn gửi')
      .setRequired(true)
      .setMaxLength(2000)),

  // --- CÁC LỆNH MỚI QUẢN LÝ WEBSITE TOKEN & 2FA ---
  new SlashCommandBuilder()
    .setName('gettoken')
    .setDescription('Lấy hoặc tạo mới Token cá nhân dùng để đăng nhập Website'),

  new SlashCommandBuilder()
    .setName('get2fa')
    .setDescription('Lấy mã xác nhận 2FA (có hiệu lực trong 5 phút) để xác thực đăng nhập Website'),

  new SlashCommandBuilder()
    .setName('resettoken')
    .setDescription('Cấp lại Token mới cho người dùng (Chỉ Admin/Owner)')
    .addUserOption(option => option.setName('target').setDescription('Người dùng cần cấp lại Token').setRequired(true))

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Registered Slash Commands successfully!');
  } catch (error) {
    console.error(error);
  }
})();

function generateRandomKey() {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `pain_${randomDigits}`;
}

// Hàm sinh Token ngẫu nhiên cho Web
function generateWebToken() {
  return 'PAIN_WEB_' + crypto.randomBytes(16).toString('hex').toUpperCase();
}

// Hàm sinh mã 2FA 6 chữ số ngẫu nhiên
function generate2FACode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function isBotAdmin(userId) {
  if (userId === OWNER_ID) return true;
  const admin = await AdminModel.findOne({ userId });
  return !!admin;
}

async function rememberUser(userId) {
  await UserModel.updateOne({ userId }, { userId }, { upsert: true });
}

function formatExpiry(expireTimestamp) {
  if (expireTimestamp === -1) return 'Vĩnh viễn';
  if (expireTimestamp == null) return 'Chưa kích hoạt';
  return `<t:${Math.floor(expireTimestamp / 1000)}:R>`;
}

function getDurationMilliseconds(duration) {
  if (duration === '1d') return 1 * 24 * 60 * 60 * 1000;
  if (duration === '3d') return 3 * 24 * 60 * 60 * 1000;
  if (duration === '7d') return 7 * 24 * 60 * 60 * 1000;
  if (duration === '30d') return 30 * 24 * 60 * 60 * 1000;
  if (duration === 'permanent') return -1;
  return null;
}

function formatDuration(durationMs) {
  if (durationMs === -1) return 'Vĩnh viễn kể từ lúc redeem';
  if (durationMs == null) return 'Theo thời hạn cũ của key';
  const durationDays = durationMs / (24 * 60 * 60 * 1000);
  return `${durationDays} ngày kể từ lúc redeem`;
}

async function getValidAccessKey(userId) {
  const userData = await AccessModel.findOne({ userId });
  if (!userData) return null;

  const now = Date.now();
  if (userData.expiresAt !== -1 && Number.isFinite(userData.expiresAt) && now >= userData.expiresAt) {
    await AccessModel.deleteOne({ userId });
    return null;
  }

  return userData;
}

/* ---------------- XỬ LÝ TƯƠNG TÁC LỆNH DISCORD ---------------- */

client.on('interactionCreate', async interaction => {
  if (!interaction.guildId) {
    return await interaction.reply({
      embeds: [createBotEmbed({
        title: '⛔ KHÔNG THỂ SỬ DỤNG TRONG DM',
        description: `Vui lòng tham gia **Server Chính Thức** để sử dụng tính năng!\n\n👉 [**[ BẤM VÀO ĐÂY ĐỂ VÀO SERVER ]**](${SERVER_INVITE_LINK})`,
        color: COLORS.ERROR
      })],
      ephemeral: true
    });
  }

  if (interaction.guildId !== MAIN_SERVER_ID) {
    return await interaction.reply({
      embeds: [createBotEmbed({
        title: '🏰 MÁY CHỦ BẢO HỘ',
        description: `Bot chỉ hỗ trợ hoạt động tại **Server Chính Thức (Nhà Của Bot)**.\n\n👉 [**[ BẤM VÀO ĐÂY ĐỂ VỀ SERVER NHÀ ]**](${SERVER_INVITE_LINK})`,
        color: COLORS.ERROR
      })],
      ephemeral: true
    });
  }

  const userId = interaction.user.id;
  const userLocale = interaction.locale || 'vi';

  if (userId !== OWNER_ID) {
    const now = Date.now();
    const lastInteractionAt = commandCooldowns.get(userId);

    if (lastInteractionAt && now - lastInteractionAt < COMMAND_COOLDOWN_MS) {
      const remainingTime = Math.ceil((COMMAND_COOLDOWN_MS - (now - lastInteractionAt)) / 1000);
      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '⚠️ Anti-Spam System',
            description: `Bạn đang thao tác quá nhanh, vui lòng đợi **${remainingTime}s** nữa để sử dụng lại lệnh!`,
            user: interaction.user,
            locale: userLocale,
            color: COLORS.OWNER
          })
        ],
        ephemeral: true
      });
    }

    commandCooldowns.set(userId, now);
  }

  await rememberUser(interaction.user.id);

  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    // --- LỆNH XỬ LÝ TOKEN WEBSITE (/gettoken) ---
    if (commandName === 'gettoken') {
      let webUser = await AuthWebModel.findOne({ userId: interaction.user.id });

      if (!webUser) {
        const newToken = generateWebToken();
        webUser = await AuthWebModel.create({
          userId: interaction.user.id,
          token: newToken
        });
      }

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '🔑 TOKEN ĐĂNG NHẬP WEBSITE',
            description: 'Dưới đây là mã Token bảo mật của bạn. Vui lòng giữ kín và không chia sẻ cho người khác!',
            fields: [
              { name: '🛡️ Token Website của bạn', value: `\`\`\`\n${webUser.token}\n\`\`\``, inline: false },
              { name: '💡 Hướng dẫn', value: 'Copy chuỗi token trên và dán vào ô **XÁC THỰC TOKEN** trên Web.', inline: false }
            ],
            user: interaction.user,
            color: COLORS.SUCCESS
          })
        ],
        ephemeral: true
      });
    }

    // --- LỆNH XỬ LÝ MÃ 2FA WEBSITE (/get2fa) ---
    if (commandName === 'get2fa') {
      let webUser = await AuthWebModel.findOne({ userId: interaction.user.id });

      if (!webUser) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Chưa Có Token',
              description: 'Bạn chưa tạo Token! Vui lòng dùng lệnh `/gettoken` trước khi lấy mã 2FA.',
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const code2FA = generate2FACode();
      const expiresAt = Date.now() + 5 * 60 * 1000; // Hết hạn trong 5 phút

      webUser.twoFactorCode = code2FA;
      webUser.twoFactorExpiresAt = expiresAt;
      await webUser.save();

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '🔐 MÃ XÁC THỰC 2FA WEBSITE',
            description: 'Sử dụng mã 6 chữ số dưới đây để hoàn tất bước đăng nhập trên Web.',
            fields: [
              { name: '🔢 Mã 2FA của bạn', value: `\`\`\`\n${code2FA}\n\`\`\``, inline: true },
              { name: '⏱️ Thời gian hiệu lực', value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true }
            ],
            user: interaction.user,
            color: COLORS.ADMIN
          })
        ],
        ephemeral: true
      });
    }

    // --- LỆNH CẤP LẠI TOKEN DÀNH CHO ADMIN (/resettoken) ---
    if (commandName === 'resettoken') {
      if (!(await isBotAdmin(interaction.user.id))) {
        return await interaction.reply({
          embeds: [createBotEmbed({ title: '❌ Quyền truy cập bị từ chối', description: 'Bạn không đủ thẩm quyền!', color: COLORS.ERROR })],
          ephemeral: true
        });
      }

      const targetUser = interaction.options.getUser('target', true);
      const newToken = generateWebToken();

      await AuthWebModel.updateOne(
        { userId: targetUser.id },
        { token: newToken, twoFactorCode: null, twoFactorExpiresAt: 0 },
        { upsert: true }
      );

      await sendOwnerLog('Cấp lại Web Token', [
        { name: 'Người nhận', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Token mới', value: `\`${newToken}\``, inline: false }
      ], interaction.user);

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '🔄 CẤP LẠI TOKEN THÀNH CÔNG',
            description: `Đã đổi Token Web mới cho thành viên: **${targetUser.tag}**`,
            fields: [
              { name: '🔑 Token Mới', value: `\`\`\`\n${newToken}\n\`\`\``, inline: false }
            ],
            color: COLORS.SUCCESS
          })
        ],
        ephemeral: true
      });
    }

    if (commandName === 'getclonepre') {
      if (!(await getValidAccessKey(interaction.user.id))) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '🔒 Truy Cập Bị Khóa',
            description: 'Bạn chưa kích hoạt key hoặc key đã hết hạn! Dùng `/redeemkey` để kích hoạt.',
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const region = interaction.options.getString('region', true);
      const allLinks = await LinkModel.find({});
      
      const filteredLinks = allLinks.filter(item => {
        return item.links && item.links.premium && item.links.premium[region] && item.links.premium[region].url;
      });

      if (filteredLinks.length === 0) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '❌ Thao Tác Thất Bại',
            description: `Hiện chưa có bản Clone Premium nào khả dụng cho khu vực **${region.toUpperCase()}**!`,
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const options = filteredLinks.map(item => {
        const data = item.links.premium[region];
        const vText = data.version || 'v1.0';
        return {
          label: `${item.category} [${vText}]`,
          description: `Phiên bản: ${vText} -${data.note || 'Không có ghi chú'}`.slice(0, 100),
          value: JSON.stringify({ cat: item.category, reg: region })
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('user_select_clone_pre_category')
        .setPlaceholder(`--- Chọn bản Clone Premium (${region.toUpperCase()}) ---`)
        .addOptions(options.slice(0, 25));

      return await interaction.reply({
        embeds: [createBotEmbed({
          title: `👇 DANH SÁCH CLONE PREMIUM (${region.toUpperCase()})`,
          description: `Vui lòng chọn mục Clone bạn muốn lấy link từ menu bên dưới:`,
          color: COLORS.DEFAULT
        })],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }

    if (commandName === 'getclonefree') {
      const region = interaction.options.getString('region', true);
      const allLinks = await LinkModel.find({});
      
      const filteredLinks = allLinks.filter(item => {
        return item.links && item.links.free && item.links.free[region] && item.links.free[region].url;
      });

      if (filteredLinks.length === 0) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '❌ Thao Tác Thất Bại',
            description: `Hiện chưa có bản Clone Miễn Phí nào khả dụng cho khu vực **${region.toUpperCase()}**!`,
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const options = filteredLinks.map(item => {
        const data = item.links.free[region];
        const vText = data.version || 'v1.0';
        return {
          label: `${item.category} [${vText}]`,
          description: `Phiên bản: ${vText} -${data.note || 'Không có ghi chú'}`.slice(0, 100),
          value: JSON.stringify({ cat: item.category, reg: region })
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('user_select_clone_free_category')
        .setPlaceholder(`--- Chọn bản Clone Miễn Phí (${region.toUpperCase()}) ---`)
        .addOptions(options.slice(0, 25));

      return await interaction.reply({
        embeds: [createBotEmbed({
          title: `🎁 DANH SÁCH CLONE MIỄN PHÍ (${region.toUpperCase()})`,
          description: `Vui lòng chọn mục Clone Miễn Phí bạn muốn lấy link từ menu bên dưới:`,
          color: COLORS.MEMBER
        })],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }

    if (commandName === 'setstatus') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const allLinks = await LinkModel.find({});
      if (allLinks.length === 0) {
        return await interaction.reply({
          embeds: [createBotEmbed({
            title: '❌ Thao tác thất bại',
            description: 'Hiện chưa có bản Clone nào được thiết lập trong hệ thống!',
            color: COLORS.ERROR
          })],
          ephemeral: true
        });
      }

      const options = allLinks.map(item => ({
        label: item.category,
        description: `Mục: ${item.category}`,
        value: JSON.stringify({ cat: item.category })
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_select_setstatus_category')
        .setPlaceholder('--- Chọn mục Clone muốn cập nhật trạng thái ---')
        .addOptions(options.slice(0, 25));

      return await interaction.reply({
        embeds: [createBotEmbed({
          title: '⚙️ CẬP NHẬT TRẠNG THÁI CLONE',
          description: 'Vui lòng chọn mục Clone bạn muốn thay đổi trạng thái:',
          color: COLORS.ADMIN
        })],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }

    if (commandName === 'removelink') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const allLinks = await LinkModel.find({});
      if (allLinks.length === 0) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Thao tác thất bại',
              description: 'Không có dữ liệu Clone nào trong hệ thống để xóa!',
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const options = [
        {
          label: '🔥 [XÓA TẤT CẢ DỮ LIỆU HỆ THỐNG]',
          description: 'Xóa toàn bộ tất cả bản Clone (Cả Free và Premium) khỏi database!',
          value: JSON.stringify({ action: 'DELETE_ALL' })
        },
        ...allLinks.map(item => ({
          label: `📌 Mục: ${item.category}`,
          description: `Chọn để xóa theo khu vực hoặc xóa toàn bộ mục ${item.category}`,
          value: JSON.stringify({ action: 'CHOOSE_CAT', cat: item.category })
        }))
      ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_select_remove_category')
        .setPlaceholder('--- Chọn mục Clone muốn xóa ---')
        .addOptions(options.slice(0, 25));

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '🗑️ XÓA PHIÊN BẢN CLONE',
            description: 'Chọn mục Clone cụ thể hoặc tùy chọn xóa toàn bộ hệ thống:',
            color: COLORS.ERROR
          })
        ],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }

    if (commandName === 'status') {
      const userData = await getValidAccessKey(interaction.user.id);

      if (!userData) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '📊 Trạng Thái Tài Khoản',
              description: 'Bạn chưa kích hoạt key hoặc thời hạn đã hết. Hãy nhập key bằng lệnh `/redeemkey`!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      if (userData.expiresAt === -1) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '📊 Trạng Thái Tài Khoản',
              description: 'Thời hạn sử dụng bot của bạn là **Vĩnh viễn**!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.SUCCESS
            })
          ],
          ephemeral: true
        });
      }

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '📊 Trạng Thái Tài Khoản',
            description: `Thời hạn sử dụng bot còn lại là ${formatExpiry(userData.expiresAt)}. Bạn chỉ cần nhập 1 key mới ở lệnh /redeemkey có thể cộng dồn thêm thời hạn!`,
            user: interaction.user,
            locale: userLocale,
            color: COLORS.MEMBER
          })
        ],
        ephemeral: true
      });
    }

    if (commandName === 'help') {
      const helpEmbed = createBotEmbed({
        title: '📖 Hướng dẫn sử dụng hệ thống',
        description: 'Dưới đây là các lệnh sẵn có trong bot.',
        user: interaction.user,
        locale: userLocale,
        color: COLORS.MEMBER,
        fields: [
          {
            name: '👥 Dành cho Member',
            value: [
              '`/getclonepre region:<Global/VNG>` — Lấy link Clone Premium (Cần Key).',
              '`/getclonefree region:<Global/VNG>` — Lấy link Clone Miễn Phí.',
              '`/redeemkey key:<mã-key>` — Nhập key kích hoạt.',
              '`/status` — Kiểm tra thời hạn sử dụng bot còn lại.',
              '`/gettoken` — Lấy Token đăng nhập Website.',
              '`/get2fa` — Lấy mã 2FA xác nhận đăng nhập Web.'
            ].join('\n')
          },
          {
            name: '🛠️ Dành cho Admin',
            value: [
              '`/setlinkclone type:<Free/Premium> category:<mục> region:<Global/VNG> link:<URL> status:<trạng-thái>` — Cập nhật link.',
              '`/setstatus` — Chọn mục Clone & khu vực để thay đổi trạng thái nhanh.',
              '`/removelink` — Xóa mục Clone theo khu vực cụ thể hoặc xóa tất cả.',
              '`/createkey duration:<thời-hạn> target_user:<member>` — Tạo key kích hoạt.',
              '`/resettoken target:<member>` — Đổi Token Web mới cho người dùng.'
            ].join('\n')
          },
          {
            name: '👑 Dành cho Owner',
            value: [
              '`/setadmin action:<Add/Remove> user:<member>` — Thêm hoặc xóa Admin.',
              '`/removekey key:<mã-key>` — Xóa vĩnh viễn key chưa sử dụng.',
              '`/notification message:<nội-dung>` — Gửi tin nhắn hàng loạt qua DM.'
            ].join('\n')
          }
        ]
      });

      return await interaction.reply({ embeds: [helpEmbed], ephemeral: false });
    }

    if (commandName === 'notification') {
      if (interaction.user.id !== OWNER_ID) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Không đủ thẩm quyền',
              description: 'Chỉ Chủ sở hữu Bot (Owner) mới có quyền dùng lệnh này!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const message = interaction.options.getString('message', true).trim();
      await interaction.deferReply({ ephemeral: true });

      const allUsers = await UserModel.find({});
      let successCount = 0;
      let failedCount = 0;

      for (const doc of allUsers) {
        try {
          const user = await client.users.fetch(doc.userId);
          await user.send({
            embeds: [
              createBotEmbed({
                title: '👑 Thông Báo Từ Owner',
                description: message,
                user,
                locale: userLocale,
                color: COLORS.OWNER
              })
            ]
          });
          successCount += 1;
        } catch (_error) {
          failedCount += 1;
        }
      }

      return await interaction.editReply({
        embeds: [
          createBotEmbed({
            title: '📢 Kết quả gửi thông báo',
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: '✅ Gửi thành công', value: `${successCount} member`, inline: true },
              { name: '❌ Gửi thất bại', value: `${failedCount} member`, inline: true }
            ],
            color: COLORS.SUCCESS
          })
        ]
      });
    }

    if (commandName === 'setadmin') {
      if (interaction.user.id !== OWNER_ID) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Lỗi phân quyền',
              description: 'Chỉ Owner mới có thẩm quyền quản trị danh sách Admin.',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const action = interaction.options.getString('action', true);
      const targetUser = interaction.options.getUser('user', true);

      if (action === 'add') {
        await AdminModel.updateOne({ userId: targetUser.id }, { userId: targetUser.id }, { upsert: true });
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '✅ Thêm Admin thành công',
              description: `Đã cấp quyền Admin cho: **${targetUser.tag}**`,
              user: interaction.user,
              locale: userLocale,
              color: COLORS.OWNER
            })
          ],
          ephemeral: true
        });
      } else if (action === 'remove') {
        await AdminModel.deleteOne({ userId: targetUser.id });
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '✅ Thu hồi Admin thành công',
              description: `Đã xóa quyền Admin của: **${targetUser.tag}**`,
              user: interaction.user,
              locale: userLocale,
              color: COLORS.OWNER
            })
          ],
          ephemeral: true
        });
      }
    }

    if (commandName === 'setlinkclone') {
      if (!(await isBotAdmin(interaction.user.id))) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Quyền truy cập bị từ chối',
              description: 'Bạn không có quyền thực hiện thiết lập link.',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const type = interaction.options.getString('type');
      const category = interaction.options.getString('category').trim();
      const region = interaction.options.getString('region');
      const link = interaction.options.getString('link').trim();
      const status = interaction.options.getString('status');
      const version = interaction.options.getString('version') || 'v1.0';
      const note = interaction.options.getString('note') || 'Không có ghi chú thêm';

      let linkDoc = await LinkModel.findOne({ category });
      if (!linkDoc) {
        linkDoc = new LinkModel({ category, links: { free: {}, premium: {} } });
      }

      if (!linkDoc.links) linkDoc.links = { free: {}, premium: {} };
      if (!linkDoc.links[type]) linkDoc.links[type] = {};

      linkDoc.links[type][region] = { url: link, version, note, status };
      
      linkDoc.markModified('links');
      await linkDoc.save();

      // GỬI LOG VỀ OWNER
      await sendOwnerLog('Cập Nhật Link Clone', [
        { name: 'Mục', value: category, inline: true },
        { name: 'Loại', value: type.toUpperCase(), inline: true },
        { name: 'Khu vực', value: region.toUpperCase(), inline: true },
        { name: 'Phiên bản', value: version, inline: true },
        { name: 'Link tải', value: link, inline: false }
      ], interaction.user);

      await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '✅ Thêm/Cập Nhật Link Thành Công',
            fields: [
              { name: 'Mục', value: category, inline: true },
              { name: 'Gói', value: type.toUpperCase(), inline: true },
              { name: 'Khu vực', value: region.toUpperCase(), inline: true },
              { name: 'Phiên bản', value: version, inline: true },
              { name: 'Ghi chú', value: note, inline: true },
              { name: 'Link Tải', value: link }
            ],
            color: COLORS.ADMIN
          })
        ],
        ephemeral: true
      });
    }

    else if (commandName === 'createkey') {
      if (!(await isBotAdmin(interaction.user.id))) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Từ chối truy cập',
              description: 'Bạn không có thẩm quyền tạo key!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const duration = interaction.options.getString('duration');
      const targetUser = interaction.options.getUser('target_user');
      await interaction.deferReply({ ephemeral: true });
      
      let generatedKey = generateRandomKey();
      while (await KeyModel.findOne({ key: generatedKey })) { 
        generatedKey = generateRandomKey(); 
      }

      const durationMs = getDurationMilliseconds(duration);
      await KeyModel.create({
        key: generatedKey,
        durationMs,
        activatedAt: null,
        expiresAt: null
      });

      const durationText = formatDuration(durationMs);
      let targetUserDetails = 'Không gửi cho member cụ thể';
      let isDirectSent = false;

      if (targetUser) {
        try {
          const fetchedTargetUser = await client.users.fetch(targetUser.id);
          await fetchedTargetUser.send({
            embeds: [
              createBotEmbed({
                title: '🔑 Nhận Mã Key Mới',
                user: fetchedTargetUser,
                locale: userLocale,
                fields: [
                  { name: 'Mã Key', value: `\`\`\`\n${generatedKey}\n\`\`\`` },
                  { name: 'Thời hạn', value: durationText },
                  { name: 'Hướng dẫn', value: `Sử dụng lệnh \`/redeemkey key:${generatedKey}\` để mở khóa bot.` }
                ],
                color: COLORS.MEMBER
              })
            ]
          });
          isDirectSent = true;
          targetUserDetails = `Đã gửi cho ${fetchedTargetUser.tag} (ID:${fetchedTargetUser.id})`;
        } catch (error) {
          targetUserDetails = `Gửi thất bại cho ${targetUser.tag} (ID:${targetUser.id})`;
        }
      }

      // GỬI LOG VỀ OWNER
      await sendOwnerLog('Tạo Key Mới', [
        { name: 'Mã Key', value: `\`${generatedKey}\``, inline: true },
        { name: 'Thời hạn', value: durationText, inline: true },
        { name: 'Gửi DM cho', value: targetUser ? targetUser.tag : 'Không chọn', inline: true }
      ], interaction.user);

      await interaction.editReply({
        embeds: [
          createBotEmbed({
            title: '🔑 Tạo Key Thành Công',
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: 'Mã Key', value: `\`\`\`\n${generatedKey}\n\`\`\``, inline: false },
              { name: 'Thời hạn', value: durationText, inline: true },
              { name: 'Trạng thái DM', value: isDirectSent ? '✅ Đã gửi DM' : (targetUser ? '❌ Lỗi gửi DM' : 'Không gửi'), inline: true }
            ],
            color: COLORS.ADMIN
          })
        ]
      });
    }

    else if (commandName === 'removekey') {
      if (interaction.user.id !== OWNER_ID) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Thất bại',
              description: 'Chỉ Owner mới có quyền thu hồi/xóa key!',
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const userKey = interaction.options.getString('key', true).trim();
      await KeyModel.deleteOne({ key: userKey });

      return await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '✅ Đã Xóa Key',
            description: `Đã xóa vĩnh viễn key chưa sử dụng:\n\`\`\`\n${userKey}\n\`\`\``,
            user: interaction.user,
            locale: userLocale,
            color: COLORS.OWNER
          })
        ],
        ephemeral: true
      });
    }

    else if (commandName === 'redeemkey') {
      const userKey = interaction.options.getString('key').trim();
      const keyData = await KeyModel.findOne({ key: userKey });

      if (!keyData) {
        return await interaction.reply({
          embeds: [
            createBotEmbed({
              title: '❌ Key Không Hợp Lệ',
              description: `Mã key:\n\`\`\`\n${userKey}\n\`\`\`\nkhông tồn tại hoặc đã nhập sai!`,
              user: interaction.user,
              locale: userLocale,
              color: COLORS.ERROR
            })
          ],
          ephemeral: true
        });
      }

      const now = Date.now();
      let currentUserData = await AccessModel.findOne({ userId: interaction.user.id });
      let newExpiresAt = now;

      if (keyData.durationMs === -1) {
        newExpiresAt = -1;
      } else {
        if (currentUserData && currentUserData.expiresAt > now && currentUserData.expiresAt !== -1) {
          newExpiresAt = currentUserData.expiresAt + keyData.durationMs;
        } else {
          newExpiresAt = now + keyData.durationMs;
        }
      }

      await AccessModel.updateOne(
        { userId: interaction.user.id },
        {
          userId: interaction.user.id,
          expiresAt: newExpiresAt,
          durationMs: keyData.durationMs,
          warned24h: false,
          warned4h: false
        },
        { upsert: true }
      );

      await KeyModel.deleteOne({ key: userKey });

      await interaction.reply({
        embeds: [
          createBotEmbed({
            title: '🎉 Kích Hoạt Thành Công',
            description: `Bạn đã kích hoạt thành công key:\n\`\`\`\n${userKey}\n\`\`\``,
            user: interaction.user,
            locale: userLocale,
            fields: [
              { name: 'Thời hạn hết hạn', value: formatExpiry(newExpiresAt) }
            ],
            color: COLORS.SUCCESS
          })
        ],
        ephemeral: true
      });
    }
  }

  if (interaction.isStringSelectMenu()) {
    const { customId } = interaction;

    if (customId === 'user_select_clone_pre_category') {
      await interaction.deferUpdate();

      const { cat: category, reg: region } = JSON.parse(interaction.values[0]);

      if (!(await getValidAccessKey(interaction.user.id))) {
        return await interaction.editReply({
          embeds: [createBotEmbed({
            title: '🔒 Truy Cập Bị Khóa',
            description: 'Key của bạn đã hết hạn!',
            color: COLORS.ERROR
          })],
          components: []
        });
      }

      const linkDoc = await LinkModel.findOne({ category });
      const itemData = linkDoc?.links?.premium?.[region];

      if (!itemData || !itemData.url) {
        return await interaction.editReply({
          embeds: [createBotEmbed({
            title: '❌ Thao Tác Thất Bại',
            description: 'Link này vừa bị gỡ hoặc không tồn tại!',
            color: COLORS.ERROR
          })],
          components: []
        });
      }

      const statusMap = {
        active: { text: '🟢 Đang hoạt động', allowDownload: true },
        maintenance: { text: '🟡 Đang bảo trì / Chờ update', allowDownload: false },
        disabled: { text: '🔴 Ngừng hoạt động', allowDownload: false }
      };

      const currentStatus = statusMap[itemData.status || 'active'];

      const resultEmbed = createBotEmbed({
        title: `👑 PHIÊN BẢN PREMIUM: ${category.toUpperCase()} (${region.toUpperCase()})`,
        fields: [
          { name: '📦 Gói dịch vụ', value: '`PREMIUM`', inline: true },
          { name: '🌐 Máy chủ', value: `\`${region.toUpperCase()}\``, inline: true },
          { name: '📌 Phiên bản', value: `\`${itemData.version || 'Mới nhất'}\``, inline: true },
          { name: '📊 Trạng thái', value: `\`${currentStatus.text}\``, inline: false },
          { name: '📝 Ghi chú', value: itemData.note || 'Không có ghi chú', inline: false },
          { 
            name: '🔗 Đường dẫn tải xuống', 
            value: currentStatus.allowDownload 
              ? `${itemData.url}\n\n⚠️ **LƯU Ý:** Nghiêm cấm chia sẻ link ra ngoài, vi phạm sẽ bị khóa key vĩnh viễn!`
              : `⚠️ Link tải tạm thời ẩn do bản Clone đang ${currentStatus.text}. Vui lòng chờ Admin cập nhật!`
          }
        ],
        user: interaction.user,
        color: currentStatus.allowDownload ? COLORS.SUCCESS : COLORS.ERROR
      });

      return await interaction.editReply({ embeds: [resultEmbed], components: [] });
    }

    if (customId === 'user_select_clone_free_category') {
      await interaction.deferUpdate();

      const { cat: category, reg: region } = JSON.parse(interaction.values[0]);

      const linkDoc = await LinkModel.findOne({ category });
      const itemData = linkDoc?.links?.free?.[region];

      if (!itemData || !itemData.url) {
        return await interaction.editReply({
          embeds: [createBotEmbed({
            title: '❌ Thao Tác Thất Bại',
            description: 'Link này vừa bị gỡ hoặc không tồn tại!',
            color: COLORS.ERROR
          })],
          components: []
        });
      }

      const statusMap = {
        active: { text: '🟢 Đang hoạt động', allowDownload: true },
        maintenance: { text: '🟡 Đang bảo trì / Chờ update', allowDownload: false },
        disabled: { text: '🔴 Ngừng hoạt động', allowDownload: false }
      };

      const currentStatus = statusMap[itemData.status || 'active'];

      const resultEmbed = createBotEmbed({
        title: `🎁 PHIÊN BẢN MIỄN PHÍ: ${category.toUpperCase()} (${region.toUpperCase()})`,
        fields: [
          { name: '📦 Gói dịch vụ', value: '`FREE`', inline: true },
          { name: '🌐 Máy chủ', value: `\`${region.toUpperCase()}\``, inline: true },
          { name: '📌 Phiên bản', value: `\`${itemData.version || 'Mới nhất'}\``, inline: true },
          { name: '📊 Trạng thái', value: `\`${currentStatus.text}\``, inline: false },
          { name: '📝 Ghi chú', value: itemData.note || 'Không có ghi chú', inline: false },
          { 
            name: '🔗 Đường dẫn tải xuống', 
            value: currentStatus.allowDownload 
              ? `${itemData.url}\n\n💡 Bản Free dành cho tất cả thành viên. Chúc bạn chơi game vui vẻ!`
              : `⚠️ Link tải tạm thời ẩn do bản Clone đang ${currentStatus.text}. Vui lòng chờ Admin cập nhật!`
          }
        ],
        user: interaction.user,
        color: currentStatus.allowDownload ? COLORS.MEMBER : COLORS.ERROR
      });

      return await interaction.editReply({ embeds: [resultEmbed], components: [] });
    }

    if (customId === 'admin_select_remove_category') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const data = JSON.parse(interaction.values[0]);

      if (data.action === 'DELETE_ALL') {
        await LinkModel.deleteMany({});
        
        await sendOwnerLog('Xóa Tất Cả Dữ Liệu Clone', [
          { name: 'Chi tiết', value: 'Admin đã xóa sạch toàn bộ bản Clone trong Database' }
        ], interaction.user);

        return await interaction.update({
          embeds: [createBotEmbed({
            title: '🗑️ Xóa Thành Công',
            description: 'Đã xóa toàn bộ dữ liệu tất cả bản Clone khỏi hệ thống!',
            color: COLORS.SUCCESS
          })],
          components: []
        });
      }

      const selectedCat = data.cat;
      const regionSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`admin_remove_region|${selectedCat}`)
        .setPlaceholder(`--- Chọn khu vực cần xóa của ${selectedCat} ---`)
        .addOptions([
          { label: '🌍 Global', value: 'global', description: 'Xóa bản Clone thuộc khu vực Global' },
          { label: '🇻🇳 VNG', value: 'vng', description: 'Xóa bản Clone thuộc khu vực VNG' },
          { label: '🔥 Xóa toàn bộ mục này (Cả Global & VNG)', value: 'DELETE_WHOLE_CAT', description: 'Xóa sạch mục này khỏi database' }
        ]);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: `🗑️ XÓA CLONE: ${selectedCat}`,
          description: `Vui lòng chọn khu vực bạn muốn xóa cho mục **${selectedCat}**:`,
          color: COLORS.ERROR
        })],
        components: [new ActionRowBuilder().addComponents(regionSelectMenu)]
      });
    }

    if (customId.startsWith('admin_remove_region|')) {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const category = customId.split('|')[1];
      const selectedValue = interaction.values[0];
      const linkDoc = await LinkModel.findOne({ category });

      if (!linkDoc) {
        return await interaction.update({
          embeds: [createBotEmbed({ title: '❌ Lỗi', description: 'Dữ liệu không tồn tại!', color: COLORS.ERROR })],
          components: []
        });
      }

      if (selectedValue === 'DELETE_WHOLE_CAT') {
        await LinkModel.deleteOne({ category });

        await sendOwnerLog('Xóa Danh Mục Clone', [
          { name: 'Mục bị xóa', value: category, inline: true },
          { name: 'Phạm vi', value: 'Toàn bộ khu vực', inline: true }
        ], interaction.user);

        return await interaction.update({
          embeds: [createBotEmbed({
            title: '🗑️ Xóa Thành Công',
            description: `Đã xóa hoàn toàn mục **${category}** khỏi hệ thống!`,
            color: COLORS.SUCCESS
          })],
          components: []
        });
      }

      const reg = selectedValue;
      if (linkDoc.links?.free) delete linkDoc.links.free[reg];
      if (linkDoc.links?.premium) delete linkDoc.links.premium[reg];

      const isFreeEmpty = !linkDoc.links?.free || Object.keys(linkDoc.links.free).length === 0;
      const isPreEmpty = !linkDoc.links?.premium || Object.keys(linkDoc.links.premium).length === 0;

      if (isFreeEmpty && isPreEmpty) {
        await LinkModel.deleteOne({ category });
      } else {
        linkDoc.markModified('links');
        await linkDoc.save();
      }

      await sendOwnerLog('Xóa Khu Vực Clone', [
        { name: 'Mục', value: category, inline: true },
        { name: 'Khu vực bị xóa', value: reg.toUpperCase(), inline: true }
      ], interaction.user);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: '🗑️ Xóa Thành Công',
          description: `Đã xóa thành công bản Clone khu vực **${reg.toUpperCase()}** của mục **${category}**!`,
          color: COLORS.SUCCESS
        })],
        components: []
      });
    }

    if (customId === 'admin_select_setstatus_category') {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const { cat: selectedCategory } = JSON.parse(interaction.values[0]);

      const regionSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`admin_setstatus_region|${selectedCategory}`)
        .setPlaceholder(`--- Chọn khu vực cần đổi trạng thái ---`)
        .addOptions([
          { label: '🌍 Global', value: 'global', description: 'Chỉ đổi trạng thái cho khu vực Global' },
          { label: '🇻🇳 VNG', value: 'vng', description: 'Chỉ đổi trạng thái cho khu vực VNG' },
          { label: '⚡ Tất cả khu vực (Global & VNG)', value: 'ALL', description: 'Áp dụng cho mọi khu vực của mục này' }
        ]);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: `⚙️ CHỌN KHU VỰC: ${selectedCategory}`,
          description: `Vui lòng chọn khu vực bạn muốn cập nhật trạng thái cho **${selectedCategory}**:`,
          color: COLORS.ADMIN
        })],
        components: [new ActionRowBuilder().addComponents(regionSelectMenu)]
      });
    }

    if (customId.startsWith('admin_setstatus_region|')) {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const category = customId.split('|')[1];
      const selectedRegion = interaction.values[0];

      const statusSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`admin_apply_status|${category}|${selectedRegion}`)
        .setPlaceholder(`--- Chọn trạng thái mới (${selectedRegion.toUpperCase()}) ---`)
        .addOptions([
          { label: '🟢 Hoạt động', value: 'active', description: 'Cho phép member tải xuống bình thường' },
          { label: '🟡 Đang bảo trì / Chờ update', value: 'maintenance', description: 'Ẩn link tải và hiển thị cảnh báo' },
          { label: '🔴 Ngừng hoạt động', value: 'disabled', description: 'Ẩn link tải do ngừng hỗ trợ' }
        ]);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: `⚙️ ĐỔI TRẠNG THÁI: ${category} (${selectedRegion.toUpperCase()})`,
          description: `Vui lòng chọn trạng thái mới áp dụng:`,
          color: COLORS.ADMIN
        })],
        components: [new ActionRowBuilder().addComponents(statusSelectMenu)]
      });
    }

    if (customId.startsWith('admin_apply_status|')) {
      if (!(await isBotAdmin(interaction.user.id))) return await interaction.reply({ content: '❌ Không đủ quyền!', ephemeral: true });

      const parts = customId.split('|');
      const category = parts[1];
      const targetRegion = parts[2];
      const newStatus = interaction.values[0];

      const linkDoc = await LinkModel.findOne({ category });
      if (!linkDoc || !linkDoc.links) {
        return await interaction.update({
          embeds: [createBotEmbed({
            title: '❌ Thao tác thất bại',
            description: 'Dữ liệu không tồn tại hoặc đã bị xóa!',
            color: COLORS.ERROR
          })],
          components: []
        });
      }

      ['free', 'premium'].forEach(t => {
        if (linkDoc.links[t]) {
          if (targetRegion === 'ALL') {
            for (const reg in linkDoc.links[t]) {
              if (linkDoc.links[t][reg]) {
                linkDoc.links[t][reg].status = newStatus;
              }
            }
          } else {
            if (linkDoc.links[t][targetRegion]) {
              linkDoc.links[t][targetRegion].status = newStatus;
            }
          }
        }
      });

      linkDoc.markModified('links');
      await linkDoc.save();

      const statusNames = {
        active: '🟢 Hoạt động',
        maintenance: '🟡 Đang bảo trì / Chờ update',
        disabled: '🔴 Ngừng hoạt động'
      };

      await sendOwnerLog('Đổi Trạng Thái Clone', [
        { name: 'Mục', value: category, inline: true },
        { name: 'Khu vực', value: targetRegion.toUpperCase(), inline: true },
        { name: 'Trạng thái mới', value: statusNames[newStatus], inline: true }
      ], interaction.user);

      return await interaction.update({
        embeds: [createBotEmbed({
          title: '✅ Cập Nhật Trạng Thái Thành Công',
          description: `Đã đổi trạng thái của **${category}** (${targetRegion.toUpperCase()}) thành: **${statusNames[newStatus]}**`,
          color: COLORS.SUCCESS
        })],
        components: []
      });
    }
  }
});

client.once('ready', () => { 
  console.log(`🤖 Bot ${client.user.tag} đã sẵn sàng hoạt động!`); 
});

client.login(TOKEN);
