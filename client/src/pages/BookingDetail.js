import React, { useState, useEffect } from 'react';
import {
  Card, Descriptions, Tag, Button, Space, Row, Col, List, Timeline,
  Empty, Divider, Popconfirm, message, Form, Input, Switch, Tabs, Alert
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, EditOutlined,
  CalendarOutlined, UserOutlined, HomeOutlined, MedicineBoxOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getBooking, saveDailyRecord, checkoutBooking, cancelBooking } from '../api';

const { TextArea } = Input;

function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recordForm] = Form.useForm();
  const [savingRecord, setSavingRecord] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await getBooking(id);
      setData(result);
      const todayRecord = result.records?.find(r => r.record_date === dayjs().format('YYYY-MM-DD'));
      if (todayRecord) {
        recordForm.setFieldsValue({
          feeding: todayRecord.feeding,
          walking: todayRecord.walking,
          abnormal: todayRecord.abnormal,
          staff_name: todayRecord.staff_name,
          return_confirmed: !!todayRecord.return_confirmed
        });
      }
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleSaveRecord = async (values) => {
    setSavingRecord(true);
    try {
      await saveDailyRecord({
        booking_id: id,
        ...values
      });
      message.success('今日记录已保存');
      fetchData();
    } catch (e) {
      message.error(e.response?.data?.error || '保存失败');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleCheckout = async () => {
    try {
      await checkoutBooking(id);
      message.success('结账成功，房间已释放');
      fetchData();
    } catch (e) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelBooking(id);
      message.success('预约已取消');
      fetchData();
    } catch (e) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  if (loading) return <Card loading />;
  if (!data) return <Empty description="预约不存在" />;

  const statusColor = {
    active: 'blue',
    overdue: 'red',
    completed: 'green',
    cancelled: 'default'
  };
  const statusText = {
    active: '寄养中',
    overdue: '已超期',
    completed: '已完成',
    cancelled: '已取消'
  };

  const isActive = ['active', 'overdue'].includes(data.status);

  return (
    <div>
      <Card
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/bookings')} />
            <span>预约详情</span>
            <Tag color={statusColor[data.status]} style={{ fontSize: 14 }}>{statusText[data.status]}</Tag>
            <span style={{ color: '#999', fontSize: 14 }}>{data.booking_no}</span>
          </Space>
        }
        extra={
          <Space>
            {isActive && (
              <Popconfirm
                title="确认结账并释放房间？"
                onConfirm={handleCheckout}
                okText="确认结账"
                cancelText="取消"
              >
                <Button type="primary" icon={<CheckOutlined />}>
                  结账离店
                </Button>
              </Popconfirm>
            )}
            {data.status === 'active' && (
              <Popconfirm
                title="确认取消此预约？"
                onConfirm={handleCancel}
                okText="确认取消"
                cancelText="返回"
                okButtonProps={{ danger: true }}
              >
                <Button danger>取消预约</Button>
              </Popconfirm>
            )}
          </Space>
        }
      >
        {data.status === 'overdue' && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message={`⚠️ 寄养已超期 ${dayjs().diff(data.check_out_date, 'day')} 天`}
            description="请尽快联系主人确认续住或接回"
          />
        )}
        {!data.vaccine_valid && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="💉 疫苗状态异常"
            description={data.vaccine_expiry_date
              ? `疫苗已于 ${data.vaccine_expiry_date} 过期`
              : '未提供疫苗证明'}
          />
        )}

        <Tabs
          items={[
            {
              key: 'info',
              label: '基本信息',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <Descriptions bordered column={2} title="宠物信息">
                    <Descriptions.Item label="宠物名">
                      {data.species === 'cat' ? '🐱' : '🐕'} {data.name}
                    </Descriptions.Item>
                    <Descriptions.Item label="品种">{data.breed || '-'}</Descriptions.Item>
                    <Descriptions.Item label="年龄">{data.age ? `${data.age} 岁` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="性别">
                      {data.gender === 'male' ? '公' : data.gender === 'female' ? '母' : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="体重">{data.weight ? `${data.weight} kg` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="疫苗">
                      {data.vaccine_valid ? (
                        <Tag color="green">有效至 {data.vaccine_expiry_date}</Tag>
                      ) : (
                        <Tag color="red">已过期/未提供</Tag>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="主人姓名">{data.owner_name}</Descriptions.Item>
                    <Descriptions.Item label="联系电话">{data.owner_phone}</Descriptions.Item>
                    <Descriptions.Item label="宠物备注" span={2}>{data.notes || '-'}</Descriptions.Item>
                  </Descriptions>

                  <Descriptions bordered column={2} title="寄养信息">
                    <Descriptions.Item label="房间">
                      <HomeOutlined /> {data.room_name}
                    </Descriptions.Item>
                    <Descriptions.Item label="房间类型">
                      {data.room_type === 'cat' ? '猫房' : '犬舍'}
                    </Descriptions.Item>
                    <Descriptions.Item label="入住日期">
                      <CalendarOutlined /> {dayjs(data.check_in_date).format('YYYY-MM-DD')}
                    </Descriptions.Item>
                    <Descriptions.Item label="预计离店">
                      <CalendarOutlined /> {dayjs(data.check_out_date).format('YYYY-MM-DD')}
                    </Descriptions.Item>
                    <Descriptions.Item label="实际离店">
                      {data.actual_check_out ? dayjs(data.actual_check_out).format('YYYY-MM-DD HH:mm') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="寄养天数">
                      {dayjs(data.check_out_date).diff(dayjs(data.check_in_date), 'day')} 天
                    </Descriptions.Item>
                    <Descriptions.Item label="预估费用" span={2}>
                      <span style={{ fontSize: 20, color: '#fa8c16', fontWeight: 700 }}>¥{data.total_price}</span>
                    </Descriptions.Item>
                  </Descriptions>

                  <Descriptions bordered column={2} title="附加服务">
                    <Descriptions.Item label="喂药">
                      {data.medication ? (
                        <Space>
                          <MedicineBoxOutlined style={{ color: '#722ed1' }} />
                          <span>{data.medication}</span>
                        </Space>
                      ) : <Tag color="default">不需要</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label="洗护服务">
                      <Tag color={data.grooming ? 'cyan' : 'default'}>
                        {data.grooming ? '已预约 +¥150' : '不需要'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="接送服务">
                      <Tag color={data.pickup_service ? 'orange' : 'default'}>
                        {data.pickup_service ? '已预约 +¥80' : '不需要'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="接送时间">
                      {data.pickup_service ? (
                        <Space direction="vertical">
                          {data.pickup_time && <span>接: {dayjs(data.pickup_time).format('MM-DD HH:mm')}</span>}
                          {data.dropoff_time && <span>送: {dayjs(data.dropoff_time).format('MM-DD HH:mm')}</span>}
                        </Space>
                      ) : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="寄养备注" span={2}>{data.notes || '-'}</Descriptions.Item>
                  </Descriptions>
                </Space>
              )
            },
            {
              key: 'daily',
              label: `日常记录 (${data.records?.length || 0})`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {isActive && (
                    <Card
                      size="small"
                      title={`📝 记录今日 (${dayjs().format('YYYY-MM-DD')})`}
                      style={{ background: '#e6f4ff', borderRadius: 8 }}
                    >
                      <Form
                        form={recordForm}
                        layout="vertical"
                        onFinish={handleSaveRecord}
                        initialValues={{ return_confirmed: false }}
                      >
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item label="🍚 喂食情况" name="feeding">
                              <TextArea rows={2} placeholder="记录喂食时间、食量等" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item label="🐾 遛宠/活动" name="walking">
                              <TextArea rows={2} placeholder="记录遛宠时长、活动情况等" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item label="⚠️ 异常情况" name="abnormal">
                              <TextArea rows={2} placeholder="如有异常请详细记录" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={6}>
                            <Form.Item label="记录人" name="staff_name">
                              <Input placeholder="员工姓名" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={6}>
                            <Form.Item
                              label="✅ 接回确认"
                              name="return_confirmed"
                              valuePropName="checked"
                            >
                              <Switch checkedChildren="已确认" unCheckedChildren="未确认" />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item style={{ marginBottom: 0 }}>
                          <Button type="primary" htmlType="submit" loading={savingRecord}>
                            保存今日记录
                          </Button>
                        </Form.Item>
                      </Form>
                    </Card>
                  )}

                  {data.records && data.records.length > 0 ? (
                    <Timeline
                      items={data.records.map(r => ({
                        color: r.abnormal ? 'red' : r.return_confirmed ? 'green' : 'blue',
                        children: (
                          <Card size="small" style={{ borderRadius: 8 }}>
                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <b>{dayjs(r.record_date).format('YYYY-MM-DD dddd')}</b>
                                {r.staff_name && <Tag>{r.staff_name} 记录</Tag>}
                              </div>
                              {r.feeding && (
                                <div>
                                  <b>🍚 喂食:</b> {r.feeding}
                                </div>
                              )}
                              {r.walking && (
                                <div>
                                  <b>🐾 遛宠:</b> {r.walking}
                                </div>
                              )}
                              {r.abnormal && (
                                <div style={{ color: '#cf1322' }}>
                                  <b>⚠️ 异常:</b> {r.abnormal}
                                </div>
                              )}
                              {r.return_confirmed && (
                                <Tag color="green">✅ 接回已确认</Tag>
                              )}
                            </Space>
                          </Card>
                        )
                      }))}
                    />
                  ) : (
                    <Empty description="暂无日常记录" />
                  )}
                </Space>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}

export default BookingDetail;
